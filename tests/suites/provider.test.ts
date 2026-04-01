// tests/suites/provider.test.ts

import { createTestProvider } from "../helpers/auth";
import { updateProviderProfile, createProviderSlot } from "../helpers/provider";

export default (async () => {
  const provider = await createTestProvider();

  const updated = await updateProviderProfile(provider, {
    displayName: "Dr. Test",
    specialty: "General Medicine",
    bio: "Experienced provider"
  });
  console.log("Profile update OK");

  const now = Date.now();
  const slot = await createProviderSlot(provider, {
    start: new Date(now + 3600000).toISOString(),
    end: new Date(now + 7200000).toISOString(),
    title: "Morning Slot"
  });
  console.log("Slot creation OK:", slot.id);
})();

