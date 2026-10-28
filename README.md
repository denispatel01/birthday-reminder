# 🎂 Birthday Reminder

A small, installable web app (PWA) that shows **today's, this week's and this month's birthdays** for the Adajan satsang mandal, and lets you wish people in one tap — WhatsApp, Call, SMS or Email — plus a ready-to-send **broadcast message** in Rakesh Kaka's own style.

**Live app:** _(GitHub Pages link added after deploy)_

## Features

- **Today / Week / Month / All** views with live counts
- **Broadcast message generator** — pick who to include, choose a style (Rakesh Kaka / Gujarati / English / list), edit, then **Copy** or open **WhatsApp**
- **One-tap actions** per person: WhatsApp (pre-filled wish), Call, SMS, Email
- **Personal birthday wish** templates
- **Search & filter** by name, mobile or karyakarta; sort by name / upcoming / date
- **Add your own** birthdays (saved on the device); hide contacts you don't need
- **Age / "turns N"** calculation
- **Settings**: greeting name, country code, default message style
- **On-open birthday notification**
- **Installable** (Add to Home Screen) and **works offline**

## Data

The contact list comes from the **Adajan master sheet** (676 contacts with name, mobile, birth date, email, karyakarta and address). Contacts you add or hide are stored only on your device (localStorage).

## Tech

Plain HTML/CSS/JS — no build step, no server, no tracking. Deployed on GitHub Pages.

## Update the contact list

Replace `data.js` (`window.BIRTHDAY_DATA = [...]`) and push. Each record:

```js
{ id, name, mobile, bmonth, bday, byear, email, address, remark, gender, kkName, kkMobile, mandal }
```
