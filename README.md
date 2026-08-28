# Betkaa: Crash & Win

Build a complete, mobile-first real-time crash-game platform called BETKAA, using the uploaded reference screenshot as the primary UI reference.

Recreate the reference interface very closely in terms of layout, proportions, spacing, card structure, tabs, buttons, typography hierarchy, dark theme, multiplier history, game area, betting panels, and mobile responsiveness. Use original BETKAA branding and original aircraft artwork—do not use Aviator, Spribe, UFC, or their copyrighted logos/assets.

PLAYER APP

Header

- "‹ Go Back"

- "View Fullscreen"

- BETKAA logo

- Green KES balance

- Hamburger menu

- Chat icon

Game Area

- Status strip

- Horizontal multiplier history

- Large rounded black game card

- Animated radial background

- Original red/pink aircraft

- Curved flight trail

- Large live multiplier such as "1.09x"

- Smooth aircraft and multiplier animation

- Countdown → Running → Crashed → Next Round

The game must be server-authoritative and real-time so all connected users see the same round, multiplier, aircraft movement, and crash event.

BETTING

Create two independent betting cards, matching the reference.

Each card has:

- "Bet | Auto" tabs

- Minus button

- Bet amount

- Plus button

- Quick buttons: "100", "250", "1,000", "25,000"

- Large green "Bet" button

- During a round, change to "Cash Out"

- Show live potential payout

Auto mode:

- Auto Bet toggle

- Auto Cash Out toggle

- Cash-out multiplier field

- Number of rounds

Prevent duplicate bets, duplicate cash-outs, negative balances, and cash-outs after a crash.

LIVE BET FEED

Add:

"All Bets | Previous | Top"

Show fictional/demo users, bet amounts, multipliers, payouts, wins and losses.

Update the feed in real time without refreshing.

USER ACCOUNTS

Registration must require only:

- Mobile number

- Username

- Password

- Confirm password

No OTP.

Support Kenyan number formatting such as:

"0712345678 → +254712345678"

Login uses:

- Mobile number

- Password

Securely hash passwords and protect sessions.

WALLET

Display:

- Cash Balance

- Bonus Balance

- Total Balance

Add:

"DEPOSIT"

"WITHDRAW"

Keep financial balances server-side and maintain a complete wallet ledger.

DARaja / M-PESA

Integrate the payment layer with Safaricom Daraja 3.0 Sandbox.

Use server-side environment variables:

"MPESA_ENV"

"MPESA_CONSUMER_KEY"

"MPESA_CONSUMER_SECRET"

"MPESA_SHORTCODE"

"MPESA_PASSKEY"

"MPESA_CALLBACK_URL"

Implement server-side:

- OAuth token handling

- STK Push

- Callback processing

- Transaction verification

- Idempotency

- Payment status tracking

- Reconciliation

Never expose credentials in frontend code.

Do not credit a wallet merely because an STK Push was initiated. Credit only after confirmed payment processing.

Keep production payment configuration separate from sandbox configuration.

100% DEPOSIT BONUS

Configure:

Deposit KES 500 or more → 100% bonus

Examples:

"KES 500 deposit + KES 500 bonus = KES 1,000"

"KES 1,000 deposit + KES 1,000 bonus = KES 2,000"

Keep cash and bonus balances separate.

Only award the bonus after confirmed payment.

Display the promotion and all applicable terms clearly.

WITHDRAWALS

Create a withdrawal system with:

- Amount

- Mobile number

- Transaction ID

- Status

- Timestamp

- Provider reference

Statuses:

"PENDING"

"PROCESSING"

"COMPLETED"

"FAILED"

"REVERSED"

For the initial implementation, keep withdrawals in demo/sandbox mode unless a properly authorized production payment service is configured.

CHAT

Add a live chat accessible from the header.

Users can:

- View messages

- Send messages

- Receive real-time updates

Admins can moderate chat.

ADMIN DASHBOARD

Create a protected:

"/admin"

with role-based access.

Dashboard sections:

- Overview

- Live Game

- Users

- Bets

- Deposits

- Withdrawals

- Wallet Ledger

- Promotions

- Bonuses

- Chat

- Analytics

- Notifications

- Settings

- Audit Logs

- Admin Roles

Dashboard statistics

Show:

- Total users

- Active users

- New users

- Deposits

- Withdrawals

- Pending transactions

- Active players

- Active bets

- Betting volume

- Wins/losses

User Management

Admin can:

- Search users

- View profiles

- View balances

- View betting history

- View transactions

- Suspend/activate accounts

- Reset demo balances

Live Game Monitor

Show:

- Current round

- Current multiplier

- Round status

- Connected players

- Active bets

- Total volume

- Previous crash results

The admin must not have a hidden mechanism for secretly manipulating active game outcomes.

Payment Management

Show:

- Deposit transactions

- Withdrawal requests

- M-PESA references

- Payment status

- Failed callbacks

- Reconciliation status

Promotions

Allow authorized admins to configure:

- Minimum deposit

- Bonus percentage

- Maximum bonus

- Start/end date

- Enable/disable

Default:

"Minimum = KES 500"

"Bonus = 100%"

ANALYTICS

Provide charts for:

- Registrations

- Deposits

- Withdrawals

- Betting volume

- Payout volume

- Active users

- Game rounds

- Average bet

- Average cash-out multiplier

Time filters:

"Today | 7 Days | 30 Days | 90 Days"

SECURITY

Use:

- Server-side authorization

- Role-based access

- Secure password hashing

- Session expiration

- Rate limiting

- Input validation

- Idempotent transactions

- Server-side wallet calculations

- Audit logging

- Secure payment callbacks

- Database constraints

- Row-level security where supported

Never trust wallet amounts, payment status, game results, or admin permissions supplied by the frontend.

REAL-TIME BACKEND

Use a real-time backend/WebSocket system.

The server controls:

"WAITING → RUNNING → CRASHED → WAITING"

Synchronize all connected users.

If a user disconnects:

- Automatically reconnect

- Retrieve current round

- Synchronize multiplier

- Restore active demo bets

- Never create a separate local round

PWA / MOBILE

Make BETKAA installable as an Android-style PWA with:

- App icon

- Splash screen

- Standalone mode

- Fullscreen support

- Offline fallback

- Responsive mobile design

Optimize for:

"360px–430px"

with smooth animations and no horizontal scrolling.

IMPORTANT

Do not build a static mockup.

Build a complete, responsive, real-time BETKAA application with:

Player side + live crash-game engine + two betting cards + auto mode + mobile registration + wallet + Daraja sandbox integration + deposit/withdrawal system + 100% deposit bonus + live chat + complete admin dashboard + analytics + audit/security + PWA.

Use the uploaded screenshot as the visual reference for the interface while using original BETKAA branding and artwork.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://bettika.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cbb417ce-4b43-413e-88fc-37c7ede9e95d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
