//src/common/dto/user.dto.ts 

import type { User, Role } from '@prisma/client';

export interface UserDTO {
  id: number;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export function toUserDTO(user: User): UserDTO {
  const { id, name, email, role, createdAt } = user;

  return {
    id,
    name,
    email,
    role,
    createdAt: createdAt.toISOString(),
  };
}
