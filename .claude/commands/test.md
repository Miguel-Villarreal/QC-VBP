Start both the backend and frontend for local testing.

## Step 1: Kill any existing processes on ports 8001 and 3000

Run these commands to free the ports:
```
netstat -ano | grep ":8001 " | grep LISTENING | awk '{print $5}' | xargs -I{} taskkill //PID {} //F 2>/dev/null
netstat -ano | grep ":3000 " | grep LISTENING | awk '{print $5}' | xargs -I{} taskkill //PID {} //F 2>/dev/null
```

## Step 2: Clear the Next.js cache

```
rm -rf c:/AI/QC/frontend/.next
```

## Step 3: Start the backend in the background

```
cd c:/AI/QC/backend && python main.py &
```

## Step 4: Start the frontend dev server in the background

```
cd c:/AI/QC/frontend && npm run dev
```

Wait a few seconds for compilation, then tell the user to open http://localhost:3000 in their browser.

When the user is done testing, remind them to stop both servers. You can kill them with:
```
netstat -ano | grep ":8001 " | grep LISTENING | awk '{print $5}' | xargs -I{} taskkill //PID {} //F
netstat -ano | grep ":3000 " | grep LISTENING | awk '{print $5}' | xargs -I{} taskkill //PID {} //F
```
