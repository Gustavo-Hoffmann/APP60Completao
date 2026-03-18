import type { User } from "../types/user";

export const usersMock: User[] = [
  {
    id: "u-admin",
    name: "Gustavo Hoffmann",
    email: "admin@app60.com",
    role: "admin",
    isActive: true,
  },
  {
    id: "u-prof-1",
    name: "Prof. André",
    email: "andre@app60.com",
    role: "professor",
    isActive: true,
  },
  {
    id: "u-student-1",
    name: "Aluno Demo",
    email: "aluno@app60.com",
    role: "student",
    professorId: "u-prof-1",
    isActive: true,
  },
];