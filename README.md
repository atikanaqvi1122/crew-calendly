# CREW Calendly

A little scheduling tool I built for CREW's interview process, because Calendly wouldn't let us do the one thing we actually needed: **book more than one interview in the same time slot.**

Live here: https://atikanaqvi1122.github.io/crew-calendly/

## Why this exists

When you're running interviews with a whole team, you often have multiple interviewers free at 2:00pm and multiple candidates who can all take a 2:00pm slot. Calendly (and most booking tools) treat every slot as one-and-done — the second someone books it, it's gone. That's fine for a single person taking client calls, but it's useless when you've got a team and need to run several interviews in parallel.

So this does the same core thing Calendly does — pick a time, get a slot — but it lets a time slot stay open for booking until all the available interviewers for that slot are used up, not just one.

## How it works

**For candidates:**
- Go to the site, pick a day on the calendar, and see what times are actually open
- Enter your name and Cedar email
- Book a slot — if there's still an interviewer free at that time, you're in, even if someone already booked that same time

**For the admin (interview coordinator):**
- Click "Admin" and enter the passcode
- Add interview team members
- Pick a day, set a window (start time, end time, how long each interview should run — 15/20/30/45/60 min)
- Assign which members are available for which slots, then open those times up for booking
- Keep an eye on everything from the "Schedule management" panel — see slots vs. actual booked interviews at a glance

There's also a time zone switcher (Pakistan, India, Gulf, UK, Eastern) so candidates or interviewers in different regions see times in their own zone instead of doing the math themselves.

## Admin access

The admin view is passcode-protected so random visitors can't mess with availability or team members.

- Password: `crew2026`

(If you're reading this as a teammate — don't share this outside the team, and ping Atika if it needs to be rotated.)

## Status / notes

This was built to solve a real, specific scheduling headache for CREW's interview cycle, not as a general-purpose product — so don't expect every Calendly feature. It does one thing Calendly can't, and tries to stay simple everywhere else.

If something looks broken or a slot isn't behaving the way it should, that's probably a bug, not a feature — let me know.

---
Made by Atika.
