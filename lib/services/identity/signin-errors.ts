import { CredentialsSignin } from "next-auth";

export const EMAIL_NOT_VERIFIED_CODE = "email_not_verified";

export class EmailNotVerifiedSignin extends CredentialsSignin {
  code = EMAIL_NOT_VERIFIED_CODE;
}
