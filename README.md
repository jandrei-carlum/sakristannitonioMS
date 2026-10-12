# Ministry of Altar Servers – Member Management System

A single-page web app for the Ministry of Altar Servers of St. Anthony Ma. Zaccaria Parish (Silangan, San Mateo, Rizal). It keeps member records, tracks ministry activities, and produces reports for the parish priest.

Everything lives in one file, `index.html`. There is no build step. Data is stored in Firebase (Authentication + Cloud Firestore).

---

## Features

### Dashboard
- Welcome message and a daily Bible verse (Douay-Rheims)
- Member totals: Total, Active, Inactive, and Other Status (tap to expand every status)
- **Upcoming Activities** with "Today / Tomorrow / In n days" labels and a red flag for past activities that still need an update
- Members per group, colored by status (tap a group to open its members)
- Birthdays in the next 2 weeks
- Officers and group leaders, with vacant roles listed
- Records to Complete (missing contact numbers, birthdays, groups, confirmation records, guardian contacts)
- Liturgical season ribbon (Advent, Christmas, Lent, Easter, Ordinary Time, etc.)
- **Report** button: one-page Ministry Status Report (PDF) for the parish priest

### Members
- Search by name; filter by status, group, and role; sort by name or birthday
- Full profile with age, time in service, awards (St. Dominic Savio, St. John Berchmans), contact, guardian, and school details
- Add, edit, and delete members
- Assigning a role that someone already holds asks for confirmation and reassigns it
- Export: Attendance Sheet (PDF), All Member Details (PDF), All Member Details (CSV)
- Print a single member profile

### Activities
- **Add** an activity: title, type, date, time, venue, description
- **Mark Done** (optional remarks and number of attendees) or **Mark Not Done** (reason required)
- **Reopen** a finished activity, **edit**, or **delete**
- Filters: All, Upcoming, Needs Update, Done, Not Done; plus search
- "Needs Update" means the date has passed but the activity was never marked Done or Not Done
- **Pop-up reminder** after sign-in when an activity is within the next 3 days, or when past activities still need an update
- **Export**
  - *Activity Review (PDF)* for pre-planning: summary, totals by type and month, full activity list, not-done reasons, notes box, signature lines
  - *All Activity Details (CSV)* for Excel or Google Sheets
  - Choose the year (or all years) and an optional status filter

### Ministry Report (PDF)
Membership by group and status, officers, **ministry activities for a chosen year**, formation and sacraments, awards, and points for attention. It contains no contact details.

---

## Setup

### 1. Files
Put these in the same folder and host them on any static web host (Firebase Hosting, GitHub Pages, Netlify, etc.):

```
index.html
logos/Origin.png      (optional parish logo; the page works without it)
```

### 2. Firebase
The app uses the Firebase project configured in the `cfg` object near the top of the script.

1. **Authentication:** turn on *Email/Password* sign-in and create the admin accounts under *Authentication > Users*.
2. **Authorized domains:** add the website address where the app is hosted under *Authentication > Settings > Authorized domains*.
3. **Firestore:** create a database. The app uses two collections:
   - `members`: one document per member
   - `activities`: one document per activity

### 3. Firestore security rules
Both collections must be readable and writable by signed-in users only. If `activities` is not covered, the Activities tab and dashboard will show an error message.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /members/{id} {
      allow read, write: if request.auth != null;
    }
    match /activities/{id} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## Data fields

**members:** `lastName`, `firstName`, `middleName`, `status`, `role`, `group`, `start`, `end`, `birthday`, `gender`, `confirmation`, `contact`, `messenger`, `address`, `guardian`, `guardianContact`, `schoolLevel`, `schoolName`, `dominic`, `berchmans`

**activities:** `title`, `type`, `status` (`Scheduled`, `Done`, `Not Done`), `date`, `time`, `venue`, `description`, `reason` (for Not Done), `remarks` and `attendees` (for Done)

Dates are stored as `YYYY-MM-DD` and times as `HH:MM`.

---

## Customizing

All of these are near the top of the script in `index.html`:

| What | Where |
|------|-------|
| Member statuses | `STATUS` |
| Officer and group lead roles | `ROLES` |
| Group Sunday Mass times | `GTIME` |
| Activity types | `ATYPES` |
| Days before an activity that trigger the pop-up reminder | `NOTIFY_DAYS` (default 3) |
| Daily Bible verses | `VERSES` |
| Firebase project | `cfg` |

---

## Tips

- **Printing to PDF:** exports and reports open the browser's print window. Choose *Save as PDF* as the destination.
- **Phones:** the bottom bar switches between Dashboard, Members, and Activities. The page works best in a current version of Chrome, Edge, Safari, or Firefox.
- **Deleting vs. changing status:** deleting a member or activity is permanent. For a member who has left, change their status instead (for example Transferred or Graduated) to keep the history.
- **Slow connection:** if saving takes too long, the app says so. The change saves automatically once the device is back online.

---

## Privacy

Member records include contact details, home addresses, and information about minors. Only give admin accounts to trusted ministry leaders, keep the Firestore rules limited to signed-in users, and do not share exported files publicly.
