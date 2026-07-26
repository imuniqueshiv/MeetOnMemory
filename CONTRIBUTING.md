# 🤝 Contributing to MeetOnMemory

First of all, thank you for considering contributing to **MeetOnMemory**! 🎉

Every contribution—whether it's fixing a bug, improving documentation, enhancing the UI, or implementing a new feature—helps make the project better for everyone.

Please read this guide before contributing.

---

# 📋 Contribution Workflow

Please follow this workflow for every contribution.

1. 🍴 Fork the repository.
2. 📌 Open an Issue (or claim an existing one).
3. ⏳ Wait until the issue is assigned to you.
4. 🌿 Create a new branch.
5. 💻 Make your changes.
6. 🧪 Test everything locally.
7. 📦 Commit your changes.
8. 🚀 Push your branch.
9. 🔁 Open a Pull Request.

---

# 📌 Issue First Policy

Before writing any code:

- ✅ Search existing Issues first.
- ✅ If the issue already exists, comment:

```text
/claim
```

- ✅ Wait until the issue is assigned to you.
- ✅ Start working only after assignment.

If no suitable issue exists:

- Create a new Issue.
- Wait for maintainer approval before starting implementation.

---

# 🔓 Releasing an Issue

If you're unable to continue working on an assigned issue, simply comment:

```text
/unclaim
```

This allows another contributor to work on it.

---

# 🚫 Important Contribution Rules

Please follow these rules carefully.

### ✅ Do

- Open or claim an Issue first.
- Wait for assignment (`/claim`).
- Keep one Pull Request focused on one Issue.
- Write clean, readable code.
- Follow the existing project structure.
- Test your changes locally.
- Update documentation when required.

### ❌ Don't

- Work on an Issue without claiming it.
- Submit multiple unrelated changes in one PR.
- Rename the project, logo, branding, package names, or repository references unless the Issue explicitly requests it or a maintainer approves it.
- Submit AI-generated code without reviewing and understanding it.
- Copy code from other repositories without proper attribution.
- Force push after review without explanation.

---

# 🍴 Fork the Repository

Click **Fork** on GitHub to create your own copy.

Clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/MeetOnMemory.git

cd MeetOnMemory
```

---

# 🌿 Create a Branch

Always create a new branch.

```bash
git checkout -b feature/your-feature-name
```

Examples:

```bash
git checkout -b feature/semantic-search
```

```bash
git checkout -b fix/login-validation
```

---

# ⚙️ Local Setup

## Backend

```bash
cd server

npm install
```

Create a `.env` file.

Run:

```bash
npm run server
```

---

## Frontend

```bash
cd client

npm install

npm run dev
```

---

# ✨ Coding Standards

## Frontend

- React Functional Components
- Reusable Components
- Keep Components Small
- Follow Existing Folder Structure

## Backend

- Keep Controllers Modular
- Validate Request Data
- Handle Errors Properly
- Follow Existing API Structure

## General

- Use meaningful variable names.
- Remove unused code.
- Avoid unnecessary complexity.
- Keep code readable.
- Keep PRs focused on one feature or bug.

---

# 🧹 Before You Commit & CI/CD Pipeline

To ensure code quality, we use **Husky** and **lint-staged** to automatically run ESLint and Prettier on your staged files before a commit is created. This ensures unformatted or lint-error-prone code never gets committed.
If the linting or formatting fails, the commit will be aborted until the errors are fixed.

To ensure code quality and avoid PR checklist failures, we run quality checks on every Pull Request via **GitHub Actions**.

### ⚙️ CI/CD Pipeline Checks

Every Pull Request runs the following status checks:

- **CI Pipeline / Format**: Verifies file formatting using `npm run format:check`.
- **CI Pipeline / Lint**: Runs static analysis check via `npm run lint`.
- **CI Pipeline / Prettier Check**: Checks formatting using Prettier via `npx prettier . --check`.
- **CI Pipeline / Production Build**: Compiles frontend assets for production using `npm run build`.
- **CodeQL Security Analysis**: Scans the codebase for security vulnerabilities.

### 💻 Running Checks Locally

You can run the same checks locally from the repository root:

1. **Verify Formatting**:

   ```bash
   npm run format:check
   ```

   To automatically format files:

   ```bash
   npm run format
   ```

2. **Run Lint Checks**:

   ```bash
   npm run lint
   ```

3. **Verify Production Build**:
   ```bash
   npm run build
   ```

If your changes affect the backend, make sure it starts correctly:

```bash
cd server
npm run server
```

Resolve all linting, formatting, and build issues before committing.

---

# 💬 Commit Message Convention

Use meaningful commit messages.

Examples:

```bash
git commit -m "feat: add semantic search filters"
```

```bash
git commit -m "fix: resolve login validation issue"
```

```bash
git commit -m "docs: update README"
```

```bash
git commit -m "refactor: simplify meeting controller"
```

Common prefixes:

- feat
- fix
- docs
- refactor
- style
- test
- chore

---

# 🚀 Pull Request Process

1. Sync your fork with the latest changes.
2. Create a feature branch.
3. Implement your changes.
4. Test locally.
5. Format your code.
6. Commit.
7. Push your branch.
8. Open a Pull Request.

Example:

```bash
git add .

git commit -m "feat: improve semantic search"

git push origin feature/semantic-search
```

---

# ✅ Pull Request Checklist

Before opening a Pull Request, ensure:

- [ ] Related Issue is linked.
- [ ] Issue was assigned before starting work.
- [ ] Project builds successfully (`npm run build`).
- [ ] Code is formatted (`npm run format`).
- [ ] Code passes lint checks (`npm run lint`).
- [ ] Documentation updated (if needed).
- [ ] No unnecessary files included.
- [ ] No merge conflicts.
- [ ] PR addresses only one Issue.
- [ ] Existing functionality is not broken.

---

# 🐞 Reporting Bugs

Please include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Browser / OS information

---

# 💡 Feature Requests

Please include:

- Clear description
- Use case
- Expected benefit
- Possible implementation

---

# 🎯 Areas Open for Contribution

- AI Search Improvements
- Meeting Management
- Policy Repository
- Reports & Analytics
- UI/UX Improvements
- Accessibility
- Documentation
- Testing
- Performance Optimization
- Security Improvements
- Mobile Responsiveness

---

# 👀 Review Process

Every Pull Request is reviewed by the maintainers.

During review you may be asked to:

- Fix bugs
- Improve code quality
- Resolve review comments
- Update documentation
- Re-test your implementation

Please be patient while waiting for review.

---

# 📜 Code of Conduct

Be respectful, professional, and welcoming.

We aim to maintain a positive and inclusive open-source community.

---

# ❓ Questions

If you have any questions:

- Open a Discussion
- Open an Issue
- Contact a Maintainer

We're happy to help.

---

# ❤️ Thank You

Thank you for contributing to **MeetOnMemory**!

Your contributions help make the project better for everyone.

Happy Coding! 🚀
