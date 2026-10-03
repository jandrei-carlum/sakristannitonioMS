# Ministry of Altar Servers: Member Management System

**St. Anthony Ma. Zaccaria Parish | Silangan San Mateo Rizal**

A simple, private website for keeping the ministry's member records in one place. It works on phones and laptops, and it is built for the ministry's administrators.

---

## What Is This?

This system replaces paper lists and scattered spreadsheets. Administrators can:

- Keep a profile for every member
- See the ministry at a glance on a dashboard
- Track officers, group leads, statuses, and awards
- Print attendance sheets and the full member list

Only approved administrators can sign in. Everyone else sees only the sign-in page.

---

## Features at a Glance

| Feature | What It Does |
| --- | --- |
| **Admin Sign In** | Only approved accounts can open the records. |
| **Dashboard** | Shows totals, members per group, birthdays, officers, and records that still need details. |
| **Members List** | Search by name, filter by status, group, or role, and sort by last name or birthday. |
| **Member Profile** | One page per member with age, time in service, awards, and all contact details. |
| **Awards** | Records the Saint Dominic Savio Award and the Saint John Berchmans Award, each with the date given. |
| **Export and Print** | Attendance sheet, master list of all members, and a CSV file for spreadsheets. |
| **Church Calendar Ribbon** | A small ribbon in the header changes color with the liturgical season. |

---

## How to Use It

### Signing In

1. Open the website link.
2. Enter your email and password, then select **Sign In**.
3. Use the eye icon to show or hide your password.
4. Select **Sign Out** when you are done, especially on a shared device.

### Dashboard

The dashboard has four summary cards at the top and four information cards below:

- **Members per Group:** how many members are in Groups 1 to 5.
- **Birthdays This Month:** who has a birthday, with today's birthdays highlighted. If there are none, it shows **Coming Up** with the next three birthdays.
- **Officers and Leaders:** the current officers and group leads, with the vacant roles listed at the bottom.
- **Records to Complete:** how complete the records of active members are. Tap an item to see who is missing that detail, then tap a name to open the profile.

### Adding a Member

1. Go to **Members** and select **Add Member**.
2. Fill in the form. Only the **first name** and **last name** are required.
3. Select **Save Member**.

### Editing or Deleting a Member

1. Open the member from the list to see their profile.
2. Select **Edit**, make your changes, then select **Save Member**.
3. To remove a member, select **Delete** inside the Edit window and confirm.

### Searching and Filtering

- Type a name in the search bar.
- Select **Filters** to choose a status, group, or role, or to sort by birthday. A number on the button shows how many filters are active.
- Active filters appear under the search bar. Tap one to remove it, or use **Clear All** in the filter window.

### Printing and Exporting

Select **Export** on the Members page and choose one of three options:

| Option | What You Get |
| --- | --- |
| **Attendance Sheet (PDF)** | A landscape sheet with No., Full Name, Time In, Time Out, and Signature. Add an event name and date, and choose a group or status. It defaults to active members. |
| **All Member Details (PDF)** | A landscape master list with every detail of every member. |
| **All Member Details (CSV)** | A file you can open in Excel or Google Sheets. |

On a member's profile, select **Print Profile** for a one-page summary.

For PDFs, a print window opens. Choose **Save as PDF** as the destination. If the preview is not landscape, switch the layout to **Landscape**.

---

## Member Information

### Details Recorded for Each Member

- **Name:** last name, first name, middle name
- **Service:** status, role, group, start and end of service
- **Personal:** birthday, gender, Sacrament of Confirmation
- **Contact:** contact number, Messenger, home address
- **Parent or Guardian:** name and contact number
- **School:** level and school name
- **Awards:** date given for each award

### Statuses

| Status | Meaning |
| --- | --- |
| 🟢 **Active** | Currently serving in the ministry |
| 🟡 **Inactive** | Still a member, but currently not serving |
| 🔵 **Probationary** | New member undergoing formation or training |
| 🟣 **On Leave** | Temporarily unable to serve |
| ⚫ **Suspended** | Temporarily restricted from serving |
| 🎓 **Graduated** | Completed their time in the ministry |
| 🕊️ **Deceased** | Member who has passed away |
| 🔄 **Transferred** | Continued their ministry or service elsewhere |
| 📜 **Honorary / Alumni** | Former member who remains part of the ministry's historical community |

Two older statuses are kept for existing records: **Not Recommissioned** and **No Longer a Member**.

### Roles

Each role has its own icon:

| Role | Icon |
| --- | --- |
| President | Crown |
| Coordinator | Compass |
| Vice President | Shield |
| Secretary | Notebook |
| Treasurer | Wallet |
| Property Custodian | Key |
| Group 1 Lead to Group 5 Lead | Flag |

Each role can be held by one member at a time. If you give a role to someone new, the system asks you to confirm, then moves the previous holder to a regular member with no role.

### School Levels

Grade 4 to Grade 12, Bachelor's Year 1 to Year 5, Graduate (Bachelor's), Masteral, and Doctorate.

### Awards

| Award | Given For |
| --- | --- |
| **Saint Dominic Savio Award** | Exemplary performance, the epitome of an altar server |
| **Saint John Berchmans Award** | More than a decade of faithful dedication and service |

In the Edit window, enter the **date given** to award a member. Leave the date blank if the member has not received it. On the profile, a received award appears as a colored medal with the date, and an award not yet received appears as a faded medal.

### Church Calendar Ribbon

The ribbon beside the header follows the Church year automatically:

| Color | Season or Day |
| --- | --- |
| Green | Ordinary Time |
| Purple | Advent, Lent, Holy Week |
| White | Christmas, Easter, Holy Thursday |
| Red | Palm Sunday, Good Friday, Pentecost |

Dates near the end of the Christmas season are approximate.

---

## Good to Know

- **Deceased members** are left out of the birthday lists.
- **Names saved in all capitals or all lowercase** are shown in proper case.
- **Birthdays** can be saved in several date formats. The system reads them and displays them consistently.
- **Only Active members** are counted in the "Records to Complete" card and are listed on attendance sheets by default.

---

## Privacy and Responsibility

This system stores personal information, including the details of minors and their parents or guardians.

- Share the sign-in details only with approved administrators.
- Sign out when using a shared or public device.
- Do not post exported files, printed lists, or screenshots publicly.
- Keep exported CSV files and PDFs in a safe place, and delete copies you no longer need.

---

## Setup Guide for the Maintainer

### What the System Is Made Of

| Part | Purpose |
| --- | --- |
| `index.html` | The entire website in one file |
| `logos/Origin.png` | The ministry logo shown in the header and on printouts |
| Firebase Authentication | Handles administrator sign-in |
| Firebase Firestore | Stores the member records |
| Netlify | Hosts the website so it can be opened from any device |

Keep `index.html` and the `logos` folder together in one folder.

### Updating the Website

1. Edit or replace `index.html` on your computer.
2. Open your site on Netlify and go to the **Deploys** tab.
3. Drag the whole folder onto the page. The site updates within seconds.

### Adding or Removing an Administrator

1. In the Firebase console, go to **Authentication** and then **Users**.
2. Select **Add User** and enter the email and a password.
3. Add the email to the security rules below, then select **Publish**.

To remove an administrator, delete the user and remove the email from the rules.

### Security Rules

In the Firebase console, go to **Firestore Database** and then **Rules**, and use the following with your administrators' emails:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null
        && request.auth.token.email in ["admin1@example.com","admin2@example.com"];
    }
  }
}
```

These rules make sure that only the listed emails can read or change the records, even if someone finds the website link.

### Allowing the Website Address

If sign-in shows an "address is not authorized" message, go to **Authentication**, then **Settings**, then **Authorized Domains**, and add the website address (without `https://`).

### Backups

Export **All Member Details (CSV)** from time to time and keep the file somewhere safe.

---

## Troubleshooting

| Problem | What to Try |
| --- | --- |
| The logo does not show | Make sure the file is named exactly `Origin.png` and sits inside a folder named `logos` next to `index.html`. |
| "Wrong email or password" | Check both, or reset the password in Firebase under Authentication. |
| "Address is not authorized" | Add the website address under Authorized Domains in Firebase. |
| "This account does not have access" | Add the signed-in email to the security rules and publish them. |
| A birthday does not appear | Open the member's profile and check the Birthday field. Add it with Edit if it says Not Provided. |
| A role does not appear on the dashboard | Open the member, select Edit, and choose the role from the Role list. |
| The PDF is not landscape | In the print window, change the layout to Landscape. |
| Changes do not show on the live site | Redeploy the folder on Netlify, then refresh the page. |

---

## Credits

Built for the Ministry of Altar Servers of St. Anthony Ma. Zaccaria Parish, Silangan San Mateo Rizal.

*Ad Majorem Dei Gloriam*
