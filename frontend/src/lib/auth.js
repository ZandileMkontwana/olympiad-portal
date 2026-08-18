// frontend/src/lib/auth.js

export function dashboardPathForRole(role) {
  if (role === "organiser") return "/organiser"; // TODO: confirm real path with teammate, update here
  if (role === "educator") return "/educator";
  return "/login";
}