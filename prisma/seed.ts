// prisma/seed.ts
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ---------------------
  // Hash passwords
  // ---------------------
  const hashedAdminPassword = await bcrypt.hash("Admin123!", 10);
  const hashedPatientPassword = await bcrypt.hash("Patient123!", 10);
  const hashedProviderPassword = await bcrypt.hash("Provider123!", 10);

  // ---------------------
  // Seed Admin User
  // ---------------------
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Auric Admin",
      email: "admin@example.com",
      password: hashedAdminPassword,
      role: Role.ADMIN,
    },
  });

  // ---------------------
  // Seed Test Patient
  // ---------------------
  await prisma.user.upsert({
    where: { email: "patient@example.com" },
    update: {},
    create: {
      name: "Test Patient",
      email: "patient@example.com",
      password: hashedPatientPassword,
      role: Role.PATIENT,
    },
  });

  // ---------------------
  // Seed Providers + Procedures
  // ---------------------
  const providers = [
    {
      name: "Alice Smith",
      email: "alice@example.com",
      displayName: "Dr. Alice Smith",
      specialty: "ENT",
      specializations: ["Ear Wax Cleaning", "Hearing Test"],
      bio: "Experienced ENT specialist.",
      latitude: 51.5074,
      longitude: -0.1278,
      procedures: [
        { name: "Ear Wax Removal", price: 50 },
        { name: "Hearing Test", price: 75 },
        { name: "Tinnitus Management", price: 60 },
      ],
    },
    {
      name: "Bob Johnson",
      email: "bob@example.com",
      displayName: "Dr. Bob Johnson",
      specialty: "Dermatology",
      specializations: ["Skin Check", "Mole Removal"],
      bio: "Board-certified dermatologist.",
      latitude: 51.5098,
      longitude: -0.1180,
      procedures: [
        { name: "Skin Check", price: 50 },
        { name: "Mole Removal", price: 100 },
        { name: "Other", price: 70 },
      ],
    },
  ];

  for (const p of providers) {
    const provider = await prisma.provider.upsert({
      where: { userId: (await prisma.user.findUnique({ where: { email: p.email } }))?.id ?? 0 },
      update: {},
      create: {
        displayName: p.displayName,
        specialty: p.specialty,
        specializations: p.specializations,
        bio: p.bio,
        latitude: p.latitude,
        longitude: p.longitude,
        user: {
          create: {
            name: p.name,
            email: p.email,
            password: hashedProviderPassword,
            role: Role.PROVIDER,
          },
        },
      },
    });

    // Seed each provider’s procedures
    for (const proc of p.procedures) {
      await prisma.procedure.upsert({
        where: {
          name_providerId: {
            name: proc.name,
            providerId: provider.id,
          },
        },
        update: {},
        create: {
          name: proc.name,
          price: proc.price,
          providerId: provider.id,
        },
      });
    }
  }

  console.log("✅ Seed data inserted successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
