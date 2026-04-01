//src/common/dto/provider.dot.ts

import type { Provider } from '@prisma/client';

export interface ProviderDTO {
  id: number;
  displayName: string;
  specialty: string;
  bio: string | null;
  verified: boolean;
}

export function toProviderDTO(provider: Provider): ProviderDTO {
  const { id, displayName, specialty, bio, status } = provider;

  return {
    id,
    displayName,
    specialty,
    bio,
    verified: status === 'VERIFIED',
  };
}
