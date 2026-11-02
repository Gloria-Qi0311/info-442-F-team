// Placeholder for the signed-in user until UW verification (Issue 1.2) is done.
// Replace the body of useCurrentUser() with the real auth state then.
const MOCK_USER = {
  name: 'Test Student',
  uwEmail: 'student@uw.edu',
};

export function useCurrentUser() {
  return MOCK_USER;
}
