# Karaoke Bill App

This repository contains a simple web-based application for managing bills at a karaoke bar. It runs entirely in the browser without any server.

## Files
- `index.html` – login screen.
- `main.html` – main menu with navigation buttons.
- `bills.html` – bill management screen.
- `payment.html` – placeholder for payment features.
- `admin.html` – placeholder for admin features.
- `main.js` – common JavaScript for login and navigation logic.
- `edit.html` – simple form to edit an active bill name.

To use, open `index.html` in a browser. Default login credentials:
- **Email**: `admin@karaoke.jp`
- **Password**: `12345678`

## Usage

1. Open `index.html` in your web browser and log in using the credentials above.
2. After logging in, choose **伝票** to open the bill management screen.

### Creating and starting a bill

1. Click **新規伝票**.
2. Enter a bill name, select a seat and adjust the guest and plan counts.
3. Press **開始** to start the bill. A bill number is generated at this time and the bill is saved locally as active.

### Viewing active bills

1. From the bill management screen, select **入店中**.
2. The active bills page lists all bills currently in progress. Each entry shows the bill number and total amount.
3. Use the **編集** button to open the bill in the creation screen where all details can be changed. Use **清算** to mark the bill as paid.

### Settled bills

1. Once a bill is settled, it no longer appears in the active list.
2. Select **清算済** from the bill management screen to view a list of paid bills.
3. From this list you can use **戻す** to move a bill back to active or **削除** to remove it after confirming the password.
