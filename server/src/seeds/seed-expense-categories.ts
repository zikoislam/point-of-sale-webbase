import { ExpenseCategory } from '../models/ExpenseCategory';

export const seedExpenseCategories = async (): Promise<void> => {
  const categories = [
    { name: 'Shop Rent', code: 'SHOP_RENT' },
    { name: 'Electricity & Utilities', code: 'UTILITIES' },
    { name: 'Staff Salary & Allowance', code: 'STAFF_SALARY' },
    { name: 'Office Stationery & Printing', code: 'STATIONERY' },
    { name: 'Inventory Wastage & Spoilage', code: 'WASTAGE_LOSS' },
    { name: 'Tea & Refreshments', code: 'REFRESHMENT' },
  ];

  for (const c of categories) {
    await ExpenseCategory.findOneAndUpdate(
      { code: c.code },
      { $set: c },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log('✅ Default Expense Categories seeded');
};
