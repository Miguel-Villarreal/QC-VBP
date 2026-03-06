# QC For Incoming and Outgoing Products

## Business Requirements for MVP

This project is for a PROGRAM runing quality control tests for products that come into and out of our warehous. Key features:
- A user can sign in
- Persistence across sessions
- User is able to add and remove products from MASTER LIST
- User can manage EVENTS, which add records that update products that have been inspected, date of inspection, and if these products passed or failed their inspection. Events have the following fields:
-- Product (selected from a dropdown of products on the MASTER LIST)
-- Incoming or outgoing (dropdown)
-- AQL Level of inspection (An separte file must be created, with an AQL table where these refrence values are stored and consulted.) User will select appropriate AQL level to be used form a dropdown menu
-- Quantity of units inspected
-- Quantity of non-conforming units
--Pass or Fail (Should be calculated automatically based on AQL table)
- A spreadsheet must be created and updated with every change from EVENTS or change in product MASTER LIST. This spreadsheet must be integrated into Google Drive and update dinamically

## Limitations

For the MVP, there will only be a user sign in (hardcoded to 'user' and 'password') but the database will support multiple users for future.

For the MVP, this will run locally (in a docker container)

## Technical Decisions

- NextJS frontend
- Python FastAPI backend, including serving the static NextJS site at /
- Everything packaged into a Docker container
- Use "uv" as the package manager for python in the Docker container
- Start and Stop server scripts for Mac, PC, Linux in scripts/

## Coding standards

1. Use latest versions of libraries and idiomatic approaches as of today
2. Keep it simple - NEVER over-engineer, ALWAYS simplify, NO unnecessary defensive programming. No extra features - focus on simplicity.
3. Be concise. Keep README minimal. IMPORTANT: no emojis ever
4. When hitting issues, always identify root cause before trying a fix. Do not guess. Prove with evidence, then fix the root cause.
5. Ask clarifying questions whenever neccesary

## Planning

Create a formal plan.md document before we begin, outlining each of the development steps with concrete, technical reasoning and milestones, as well as tests. I will evaluate when each step is complete, debug if neccesary, and authorize so we can proceed to the next step.

Here are the steps:

### Building initial instance
1) Build an instance that can be tested, without persistence. Please suggest the best format to use for the instance (html, or a docker container, or something else). Objective is to check look and feel, see if MASTER LIST and EVENTS work properly (The AQL section in EVENTS does notr have to work yet)

### Determining AQL levels
2) Build a table with the AQL information (acceptable quality levels), that will be used by an EVENT to create the dropdown were the USER will select the AQL level for each EVENT. You must research AQL levels from trusted sources and incorporate this into the table.

### Converting AQL to Doc
3) Once the table is approved, convert it into a file type that can be used by the PROGRAM to inform the AQL dropdown inside EVENTS, and perform the correct calculations.

### Connecting AQL doc to AQL dropdown in EVENTS
4) Ensure the data from the AQL table doc correctly feeds into the PROGRAM, so it can be used by the EVENTS section

### Connecting to spreadsheet
5) Create a spreadheet doc that is dinamically updated with any EVENTS or changes in the MASTER LIST 

### Add persistence and user sign in
6) Ensure data persists between sessions and page reloads

After these steps are complete, I will decide how we proceed.