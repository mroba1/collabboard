import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'password123';

const DEMO_USERS = [
  { name: 'Jordan Reyes', email: 'jordan@example.com', color: '#10b981' },
  { name: 'Alex Kim', email: 'alex@example.com', color: '#f97316' },
  { name: 'Morgan Patel', email: 'morgan@example.com', color: '#8b5cf6' },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const users = [];
  for (const u of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, passwordHash, color: u.color },
    });
    users.push(user);
  }

  const [owner, member2, member3] = users;
  if (!owner || !member2 || !member3) return;

  const board = await prisma.board.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Q3 Product Roadmap',
      color: '#10b981',
      ownerId: owner.id,
      members: {
        create: [
          { userId: owner.id, role: 'OWNER' },
          { userId: member2.id, role: 'EDITOR' },
          { userId: member3.id, role: 'EDITOR' },
        ],
      },
    },
  });

  await prisma.boardObject.upsert({
    where: { id: '00000000-0000-0000-0000-0000000000a1' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-0000000000a1',
      boardId: board.id,
      type: 'sticky',
      x: 120,
      y: 120,
      width: 200,
      height: 160,
      data: { text: 'Welcome to CollabBoard!\nTry drawing, adding shapes, or asking the AI assistant.', color: '#fde68a' },
      createdBy: owner.id,
    },
  });

  console.log('Seed complete. Demo users (password: %s):', DEMO_PASSWORD);
  for (const u of DEMO_USERS) console.log(`  - ${u.email}`);
  console.log(`Demo board: "${board.name}" (${board.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
