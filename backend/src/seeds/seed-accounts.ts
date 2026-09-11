import { Account } from '../models/Account';

export const seedAccounts = async (): Promise<void> => {
  const accounts = [
    {
      name: 'Main Cash Drawer',
      accountType: 'CASH',
      currentBalance: 5000,
      isActive: true,
    },
    {
      name: 'bKash Merchant Account',
      accountType: 'MFS',
      accountNumber: '01700000000',
      currentBalance: 15000,
      isActive: true,
    },
    {
      name: 'City Bank Business Current A/C',
      accountType: 'BANK',
      accountNumber: '110293849101',
      currentBalance: 50000,
      isActive: true,
    },
  ];

  for (const a of accounts) {
    await Account.findOneAndUpdate(
      { name: a.name },
      { $set: a },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log('✅ Default Financial Accounts seeded (Cash Drawer, bKash, Bank)');
};
