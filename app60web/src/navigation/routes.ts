export const routes = {
  login: "/login",
  dashboard: "/",
  users: "/users",
  userCreate: "/users/new",
  userEdit: (id: string) => `/users/${id}/edit`,
  myProfile: "/me/profile",
  participants: "/participants",
  participantDetail: (id: string) => `/participants/${id}`,
  questionnaires: "/questionnaires",
  tests: "/tests",
  test2mst: "/tests/2mst",
};