export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start Google OAuth through the server-owned authorization-code flow. The
// server creates and validates the state cookie, then redirects to Google.
export const startLogin = () => {
window.location.assign("https://www.waste-wise.in/api/auth/google/start");
};
