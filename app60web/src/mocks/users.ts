import type { User } from "../types/user";

export const usersMock: User[] = [
  {
    id: "u-admin",
    name: "Gustavo Hoffmann",
    email: "admin@app60.com",
    role: "ADMIN",
    isActive: true,
  },
  {
    id: "u-gestor",
    name: "Gestor Demo",
    email: "gestor@app60.com",
    role: "GESTOR",
    isActive: true,
  },
  {
    id: "u-avaliador",
    name: "Avaliador Demo",
    email: "avaliador@app60.com",
    role: "AVALIADOR",
    isActive: true,
  },
];