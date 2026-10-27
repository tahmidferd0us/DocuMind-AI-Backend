import { deleteExpiredSessions } from '../src/modules/auth/auth.repository.js';
import { disconnectDatabase } from '../src/config/database.js';

const main = async () => {
  console.log('Running daily housekeeping cleanup...');
  try {
    const result = await deleteExpiredSessions();
    console.log(`Cleaned up ${result?.count ?? 0} expired sessions.`);
  } catch (err) {
    console.error('Housekeeping cleanup failed:', err);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
};

main();
