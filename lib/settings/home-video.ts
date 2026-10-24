export const SITE_MEDIA_BUCKET = "site-media";
export const HOME_VIDEO_PREFIX = "home/";
export const HOME_VIDEO_TYPE = "video/mp4";
export const HOME_VIDEO_MAX_BYTES = 20 * 1024 * 1024;
export const HOME_VIDEO_KEY_RE =
  /^home\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp4$/;
