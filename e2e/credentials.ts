// Throwaway credentials. Build the site with a vault made from these:
//   LOGIN_USERNAME=e2e-user LOGIN_PASSWORD=e2e-test-password-123 npm run set-password
export const E2E_USERNAME = process.env.LOGIN_USERNAME ?? "e2e-user";
export const E2E_PASSWORD = process.env.LOGIN_PASSWORD ?? "e2e-test-password-123";
