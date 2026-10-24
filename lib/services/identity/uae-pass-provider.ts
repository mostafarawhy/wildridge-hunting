// UAE Pass OIDC identity provider stub — real integration is not configured.
// Flow: Authorization Code (OAuth 2.0) via https://docs.uaepass.ae/feature-guides/authentication/web-application
// Endpoints documented below are production-ready; swap baseUrl for staging during dev.
import { randomUUID } from "crypto";
import type {
  IdentityProvider,
  IdentityProviderName,
  InitiateVerificationInput,
  InitiateVerificationResult,
  CheckVerificationInput,
  CheckVerificationResult,
} from "./types";
import { env } from "@/lib/env";

// Shape returned from GET {baseUrl}/userinfo (scope: urn:uae:digitalid:profile:general).
// Attribute availability depends on userType (SOP1 < SOP2 < SOP3) and Resident vs Visitor flow.
// Reference: https://docs.uaepass.ae/resources/attributes-list
export interface UaePassUserInfo {
  // Namespaced subject identifier, format: "UAEPASS/{uuid}". Do NOT use as the primary key.
  sub: string;
  // Raw UAE Pass UUID — THIS is the primary SP linking attribute per official guidance.
  uuid: string;
  // SOP1 = basic, SOP2 = verified, SOP3 = fully verified Emirates ID holder.
  userType: "SOP1" | "SOP2" | "SOP3";
  // SmartPass UUID — present only for SOP2/SOP3 with SmartPass-verified accounts.
  spuuid?: string;
  // Verified contact attributes — present for ALL SOP levels.
  email?: string;
  mobile?: string;
  // Name — firstname/lastname EN present for ALL; AR + fullname* are SOP2/SOP3 only.
  firstnameEN?: string;
  lastnameEN?: string;
  firstnameAR?: string;
  lastnameAR?: string;
  fullnameEN?: string;
  fullnameAR?: string;
  // SOP2/SOP3 only (Residents/Citizens) — also SOP3 only for Visitors.
  gender?: string;
  nationalityEN?: string;
  nationalityAR?: string;
  titleEN?: string;
  titleAR?: string;
  idType?: string;
  // Emirates ID number — Residents/Citizens only, NEVER returned for Visitors.
  idn?: string;
  // Authentication context / methods used (e.g. mobileid, biometric).
  acr?: string;
  amr?: string[];
  // Visitor flow only.
  profileType?: "1" | "2";
  unifiedId?: string;
}

export type UaePassIdentityErrorCode =
  | "TOKEN_EXCHANGE_FAILED"
  | "TOKEN_RESPONSE_INVALID"
  | "USERINFO_FAILED"
  | "USERINFO_RESPONSE_INVALID"
  | "NETWORK_ERROR";

export type UaePassIdentityResult =
  | { success: true; userInfo: UaePassUserInfo }
  | {
      success: false;
      errorCode: UaePassIdentityErrorCode;
      errorMessage: string;
    };

class UaePassIdentityError extends Error {
  override name = "UaePassIdentityError";
  readonly errorCode: UaePassIdentityErrorCode;

  constructor(errorCode: UaePassIdentityErrorCode, message: string) {
    super(message);
    this.errorCode = errorCode;
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export class UaePassNotConfiguredError extends Error {
  override name = "UaePassNotConfiguredError";
  constructor() {
    super(
      "UAE Pass is not configured. Set UAE_PASS_CLIENT_ID, UAE_PASS_CLIENT_SECRET, UAE_PASS_BASE_URL, and UAE_PASS_REDIRECT_URI.",
    );
  }
}

export class UaePassProvider implements IdentityProvider {
  readonly name: IdentityProviderName = "uae_pass" as const;

  // Production: https://id.uaepass.ae/idshub
  // Staging:    https://stg-id.uaepass.ae/idshub  (set via UAE_PASS_BASE_URL)
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  // Scope for general profile (email, name, mobile, uuid, userType).
  // UAE Pass team may extend this per SP agreement.
  private static readonly SCOPE = "urn:uae:digitalid:profile:general";

  // ACR level: "low" covers push notification + PIN.
  // "high" adds biometric face scan.
  private static readonly ACR_VALUES =
    "urn:safelayer:tws:policies:authentication:level:low";

  private static readonly TOKEN_CONTENT_TYPE = "multipart/form-data";

  private static readonly LOGOUT_REDIRECT_PARAM = "redirect_uri";

  private static readonly REQUEST_TIMEOUT_MS = 10_000;

  constructor() {
    // Validated by factory before instantiation — safe to assert non-null here.
    this.baseUrl = env.UAE_PASS_BASE_URL!;
    this.clientId = env.UAE_PASS_CLIENT_ID!;
    this.clientSecret = env.UAE_PASS_CLIENT_SECRET!;
    this.redirectUri = env.UAE_PASS_REDIRECT_URI!;
  }

  async initiateVerification(
    input: InitiateVerificationInput,
  ): Promise<InitiateVerificationResult> {
    const state = randomUUID();

    return {
      success: true,
      applicantId: state,
      redirectUrl: this.buildAuthUrl(state, input.locale),
      rawResponse: null,
    };
  }

  async resolveIdentity(code: string): Promise<UaePassIdentityResult> {
    try {
      const accessToken = await this.exchangeCodeForToken(code);
      const userInfo = await this.getUserInfo(accessToken);
      return { success: true, userInfo };
    } catch (err) {
      if (err instanceof UaePassIdentityError) {
        return {
          success: false,
          errorCode: err.errorCode,
          errorMessage: err.message,
        };
      }
      console.error("[uae-pass] resolveIdentity failed:", err);
      return {
        success: false,
        errorCode: "NETWORK_ERROR",
        errorMessage: "Failed to reach UAE PASS.",
      };
    }
  }

  // Step 2+3 of OAuth flow: exchange auth code for token, then fetch userinfo.
  // Called from the /api/auth/uaepass/callback route handler after redirect.
  // applicantId here is the state token from initiateVerification — validate it first.
  async checkVerification(
    input: CheckVerificationInput,
  ): Promise<CheckVerificationResult> {
    // TODO: implement the code exchange and userinfo mapping; requires UAE_PASS_CLIENT_ID.
    // Implementation outline:
    //   1. Retrieve the authorization code from the callback query params (caller passes via input.applicantId or a separate field — adjust interface if needed).
    //   2. Exchange code for access token via exchangeCodeForToken().
    //   3. Fetch user profile via getUserInfo(accessToken).
    //   4. Map userType to VerificationStatus: SOP3 → APPROVED, SOP1 → PENDING.
    //   5. Return uuid as applicantId.
    void input;
    return {
      success: false,
      errorCode: "NOT_IMPLEMENTED",
      errorMessage: "UAE Pass integration is not configured.",
      rawResponse: null,
    };
  }

  buildLogoutUrl(redirectPath: string): string {
    const origin = new URL(this.redirectUri).origin;
    const params = new URLSearchParams({
      [UaePassProvider.LOGOUT_REDIRECT_PARAM]: `${origin}${redirectPath}`,
    });
    return `${this.baseUrl}/logout?${params.toString()}`;
  }

  // --- Private helpers (implement when credentials arrive) ---

  private buildAuthUrl(state: string, locale: "en" | "ar" | "ru"): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      scope: UaePassProvider.SCOPE,
      state,
      redirect_uri: this.redirectUri,
      acr_values: UaePassProvider.ACR_VALUES,
      ui_locales: locale === "ar" ? "ar" : "en",
    });
    return `${this.baseUrl}/authorize?${params.toString()}`;
  }

  // Token exchange: POST {baseUrl}/token
  //   - grant_type, redirect_uri, code passed as QUERY PARAMETERS (not body) per UAE Pass docs.
  //   - Authorization header: Basic base64(clientId:clientSecret).
  //   - Content-Type: multipart/form-data; charset=UTF-8 (NOT x-www-form-urlencoded — UAE Pass spec is non-standard here).
  //   - Returns: { access_token, token_type: "Bearer", expires_in, scope }.
  // CRITICAL: authorization code is single-use and must be exchanged within ~10 seconds of issuance.
  // redirect_uri MUST exactly match the value sent in the authorize step or token call returns invalid_grant/redirectUriMismatch.
  private async exchangeCodeForToken(code: string): Promise<string> {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri: this.redirectUri,
      code,
    });

    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString("base64");

    const response = await fetch(`${this.baseUrl}/token?${params.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": UaePassProvider.TOKEN_CONTENT_TYPE,
      },
      signal: AbortSignal.timeout(UaePassProvider.REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        `[uae-pass] token exchange failed with status ${response.status}`,
      );
      throw new UaePassIdentityError(
        "TOKEN_EXCHANGE_FAILED",
        `UAE PASS token endpoint returned ${response.status}.`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new UaePassIdentityError(
        "TOKEN_RESPONSE_INVALID",
        "UAE PASS token response was not JSON.",
      );
    }

    if (typeof payload !== "object" || payload === null) {
      throw new UaePassIdentityError(
        "TOKEN_RESPONSE_INVALID",
        "UAE PASS token response was not an object.",
      );
    }

    const candidate = payload as Record<string, unknown>;
    const keys = Object.keys(candidate);
    console.info(`[uae-pass] token response keys: ${keys.join(",")}`);

    if (keys.includes("id_token")) {
      console.error(
        "[uae-pass] UNEXPECTED id_token in token response — JWT verification was assumed absent.",
      );
    }

    const accessToken = candidate.access_token;
    if (typeof accessToken !== "string" || accessToken.length === 0) {
      throw new UaePassIdentityError(
        "TOKEN_RESPONSE_INVALID",
        "UAE PASS token response did not carry an access_token.",
      );
    }

    return accessToken;
  }

  // Userinfo: GET {baseUrl}/userinfo
  // Auth: Bearer {accessToken}
  private async getUserInfo(accessToken: string): Promise<UaePassUserInfo> {
    const response = await fetch(`${this.baseUrl}/userinfo`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(UaePassProvider.REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        `[uae-pass] userinfo failed with status ${response.status}`,
      );
      throw new UaePassIdentityError(
        "USERINFO_FAILED",
        `UAE PASS userinfo endpoint returned ${response.status}.`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new UaePassIdentityError(
        "USERINFO_RESPONSE_INVALID",
        "UAE PASS userinfo response was not JSON.",
      );
    }

    if (typeof payload !== "object" || payload === null) {
      throw new UaePassIdentityError(
        "USERINFO_RESPONSE_INVALID",
        "UAE PASS userinfo response was not an object.",
      );
    }

    const candidate = payload as Record<string, unknown>;
    console.info(
      `[uae-pass] userinfo response keys: ${Object.keys(candidate).join(",")}`,
    );

    if (typeof candidate.sub !== "string" || candidate.sub.length === 0) {
      throw new UaePassIdentityError(
        "USERINFO_RESPONSE_INVALID",
        "UAE PASS userinfo did not carry sub.",
      );
    }

    if (typeof candidate.uuid !== "string" || candidate.uuid.length === 0) {
      throw new UaePassIdentityError(
        "USERINFO_RESPONSE_INVALID",
        "UAE PASS userinfo did not carry uuid.",
      );
    }

    if (
      candidate.userType !== "SOP1" &&
      candidate.userType !== "SOP2" &&
      candidate.userType !== "SOP3"
    ) {
      throw new UaePassIdentityError(
        "USERINFO_RESPONSE_INVALID",
        "UAE PASS userinfo carried an unrecognised userType.",
      );
    }

    return {
      sub: candidate.sub,
      uuid: candidate.uuid,
      userType: candidate.userType,
      spuuid: optionalString(candidate.spuuid),
      email: optionalString(candidate.email),
      mobile: optionalString(candidate.mobile),
      firstnameEN: optionalString(candidate.firstnameEN),
      lastnameEN: optionalString(candidate.lastnameEN),
      firstnameAR: optionalString(candidate.firstnameAR),
      lastnameAR: optionalString(candidate.lastnameAR),
      fullnameEN: optionalString(candidate.fullnameEN),
      fullnameAR: optionalString(candidate.fullnameAR),
      gender: optionalString(candidate.gender),
      nationalityEN: optionalString(candidate.nationalityEN),
      nationalityAR: optionalString(candidate.nationalityAR),
      titleEN: optionalString(candidate.titleEN),
      titleAR: optionalString(candidate.titleAR),
      idType: optionalString(candidate.idType),
      idn: optionalString(candidate.idn),
      acr: optionalString(candidate.acr),
      profileType:
        candidate.profileType === "1" || candidate.profileType === "2"
          ? candidate.profileType
          : undefined,
      unifiedId: optionalString(candidate.unifiedId),
    };
  }
}
