/**
 * Admin access is controlled by ADMIN_EMAILS in .env (comma-separated, case-insensitive).
 * If unset, only ahmed.youssef@gmail.com is an admin (see config/adminAllowlist.js).
 *
 * To add an admin:
 *   1. Add their email to ADMIN_EMAILS in backend/.env
 *   2. Restart the server
 *   3. npm run sync-admin-roles
 *
 * This script only prints a reminder (it does not change the database by itself).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log(`
Admin emails are defined by ADMIN_EMAILS in backend/.env

Examples:
  ADMIN_EMAILS=ahmed.youssef@gmail.com
  ADMIN_EMAILS=alice@x.com,bob@y.com

After editing .env:
  1. Restart the API server
  2. npm run sync-admin-roles

The app ignores old "admin" rows in the database unless the email is on that list.
`);
