okI have an AR chess project where the user points the camera at a marker, a chess board appears, and the user can play against the computer.

I want to add a full user system + statistics + leaderboard without breaking the current AR functionality.

-------------------------
MAIN GOALS
-------------------------
Add:
1) Database
2) User registration & login (username + password only)
3) Match tracking & statistics (similar to chess.com)
4) Leaderboard

-------------------------
REQUIREMENTS
-------------------------

1. DATABASE
- Choose a simple database suitable for the current project stack.
- If a backend already exists, integrate the database into it.
- If not, create a minimal backend API (lightweight and easy to run).
- Keep everything simple for a university-level project.
- Design tables/models for:
  - Users
  - Matches

-------------------------

2. AUTHENTICATION
- Implement:
  - Register (username + password)
  - Login
  - Logout
- Passwords MUST be hashed (no plain text storage).
- Use session or token-based auth to keep user logged in.
- Ensure secure and simple implementation.

-------------------------

3. MATCH TRACKING
After each completed chess game, store a match record linked to the logged-in user.

Each match should include:
- result (win / loss / draw)
- date/time
- opponent = computer
- game duration
- number of moves
- user color (white / black)
- difficulty level (if available)
- ending type (checkmate / stalemate / resignation if possible)

-------------------------

4. USER STATISTICS (like chess.com)
Create a Profile / Stats page showing:

- total games played
- wins
- losses
- draws
- win rate (%)
- current win streak
- best win streak
- average game duration
- average moves per game
- games as white vs black
- recent match history (last games list)

-------------------------

5. LEADERBOARD (EXTRA FEATURE)
Create a leaderboard page that ranks users by:
- highest win rate
- most wins
- most games played

Rules:
- Only include users with at least 3 games played
- Sort properly per category
- Make it clean and readable

-------------------------

6. UI / UX CHANGES
Add:
- Login button/page
- Register button/page
- Profile / Stats page
- Leaderboard page
- Logout button

Behavior:
- If user is NOT logged in:
  - They can still play AR chess (if already supported)
  - BUT stats are NOT saved
- After a game ends:
  - If logged in → show: "Game saved to your stats"
  - If NOT logged in → show: "Login to save your game stats"

-------------------------

7. IMPORTANT CONSTRAINTS
- DO NOT break the existing AR chess functionality
- Keep marker detection and board rendering working as-is
- Keep code clean and well-structured
- Add clear comments explaining new parts

-------------------------

8. README UPDATE
Update or create README with:
- project setup steps
- how to run backend (if added)
- how to run database
- how to register/login
- how stats & leaderboard work

-------------------------

9. DEVELOPMENT PROCESS
Before coding:
- Analyze the current project structure
- Identify tech stack (frontend/backend)
- Create a short implementation plan

Then:
- Implement step-by-step
- Test:
  - Register
  - Login
  - Logout
  - Play game
  - Save match
  - View stats
  - View leaderboard

Make sure everything works end-to-end.