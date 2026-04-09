import { initDb } from '../src/db.ts';
import { createApp } from '../server.ts';

initDb();
export default createApp();
