# TankAlert - Real-Time Fuel Tank Monitoring Dashboard

## What This Application Does

**TankAlert** is a real-time fuel tank monitoring dashboard that tracks fuel levels across multiple depots and prevents fuel shortages. It's specifically designed for fuel depot operators, truck depots, and fuel supply companies.

### Core Purpose:
- **Monitor fuel tank levels** in real-time across multiple locations
- **Prevent fuel shortages** with predictive alerts and consumption tracking
- **Track fuel usage patterns** with historical dip readings and consumption analytics
- **Manage multiple depots** with role-based access for different operators
- **Alert operators** when tanks reach critical or low fuel levels

### Who Uses This:
- **Fuel depot operators** monitoring tank levels and recording fuel readings
- **Depot managers** overseeing multiple tank groups and fuel operations  
- **Fleet managers** ensuring fuel availability for truck operations
- **Fuel supply companies** managing distributed fuel infrastructure

**Business Domain**: Australian fuel supply chain management, specifically for companies like Great Southern Fuels, Swan Transit, and other fuel depot operators.

## 📁 Project Structure

The project has been organized into a clean, maintainable structure:

- **`src/`** - Application source code
- **`docs/`** - All documentation organized by category (migration, RBAC, fixes, guides)
- **`database/`** - SQL scripts organized by functionality (migrations, fixes, RBAC, views, utils)
- **`tools/`** - Utility scripts for user management, testing, and fixes
- **`scripts/`** - Build and deployment scripts
- **`.github/`** - GitHub Actions and workflows

## Continuous Integration (CI)

This project includes automated CI checks that run on every push to the main branch and pull request. The CI pipeline ensures code quality and build stability.

### What the CI checks:

1. **Linting**: Runs ESLint to check for code style and potential issues
2. **Build**: Verifies the project can be successfully built for production

### CI Status

The CI pipeline will show linting warnings and errors but won't fail the build for warnings. This allows the project to continue functioning while still providing feedback on code quality issues.

### Viewing CI Results

- **GitHub Actions**: Go to the "Actions" tab in your GitHub repository to see CI run history
- **Pull Requests**: CI status will be displayed on each PR
- **Main Branch**: CI runs automatically on every push to main

## How can I edit this code?

There are several ways of editing your application.

**Use your preferred IDE**

You can work locally using your own IDE by cloning this repo and pushing changes.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

This project can be deployed using various hosting services like Vercel, Netlify, or similar platforms that support Vite/React applications.

Build the project for production:
```sh
npm run build
```

The built files will be in the `dist` directory, ready for deployment.
