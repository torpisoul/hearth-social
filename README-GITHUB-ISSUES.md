# Creating GitHub Issues for Hearth

This guide explains how to create all the planned GitHub issues for task delegation.

## Prerequisites

**Install GitHub CLI:**

```powershell
# Windows (using winget)
winget install --id GitHub.cli

# Or download from: https://cli.github.com/
```

**Authenticate with GitHub:**

```powershell
gh auth login
```

Follow the prompts to authenticate with your GitHub account.

## Creating the Issues

### Option 1: Run the PowerShell Script (Recommended)

1. **Update the repository name** in `create-github-issues.ps1`:
   ```powershell
   $REPO = "yourusername/OptIn"  # Change to your repo
   ```

2. **Run the script:**
   ```powershell
   .\create-github-issues.ps1
   ```

3. **View created issues:**
   ```
   https://github.com/yourusername/OptIn/issues
   ```

### Option 2: Create Issues Manually

If you prefer to create issues one at a time, you can copy individual `gh issue create` commands from the script.

## What Issues Will Be Created?

The script creates **15 issues** organized into categories:

### High Priority - Supabase Integration (6 issues)
1. Setup Supabase Database Schema
2. Build Netlify Functions for Authentication
3. Build Netlify Functions for Pulse Feed
4. Build Netlify Functions for Parlor Messaging
5. Build Netlify Functions for Events
6. Build Netlify Functions for Kin Management

### Medium Priority - UI/UX Enhancements (4 issues)
7. Implement QR Code for Hearth Key Sharing
8. Implement Custom Sunset Timer Hours
9. Wire Up 'Remove Kin' and 'Message Kin' Buttons
10. Add Media Expiration in Parlor Messages
11. Improve Mobile Responsiveness

### Low Priority - Testing & Documentation (3 issues)
12. Write Unit Tests for Core Functions
13. Create User Documentation / Help Center
14. Set Up Continuous Deployment Pipeline

### Backlog - Future Enhancements (3 issues)
15. [Future] Implement Contact Discovery System
16. [Future] Add Push Notifications (Opt-In)
17. [Future] Implement PWA Features

## Labels Used

Issues are automatically labeled for organization:

- `high-priority` - Critical tasks for production
- `medium-priority` - Important but not blocking
- `enhancement` - New features or improvements
- `feature` - New functionality
- `backend` - Server-side work
- `ui` - Frontend/design work
- `database` - Database-related
- `testing` - Test coverage
- `documentation` - Docs and guides
- `devops` - Deployment and CI/CD
- `good-first-issue` - Good for new contributors
- `future` - Backlog/nice-to-have
- `requires-backend` - Needs backend implementation

## Milestones

The script assigns issues to the following milestone:

- **Phase 3: Production Backend** - Supabase integration tasks

You can create additional milestones in GitHub as needed.

## Assigning to Jules

After creating the issues, you can assign them:

**Via GitHub Web:**
1. Go to the issue
2. Click "Assignees" on the right sidebar
3. Select Jules

**Via GitHub CLI:**
```powershell
gh issue edit ISSUE_NUMBER --add-assignee jules-username
```

**Bulk assign multiple issues:**
```powershell
# Assign issues 1-6 to Jules
1..6 | ForEach-Object { gh issue edit $_ --add-assignee jules-username }
```

## Creating a Project Board

Organize issues into a Kanban board:

1. Go to your repository on GitHub
2. Click "Projects" tab
3. Click "New project"
4. Choose "Board" template
5. Name it "Hearth Development"
6. Drag issues into columns:
   - **To Do** - Not started
   - **In Progress** - Being worked on  
   - **Review** - Ready for code review
   - **Done** - Completed

## Tips for Working with Jules

1. **Start with high-priority issues** - Focus on Supabase integration first
2. **Good first issues** - Issues labeled `good-first-issue` are self-contained
3. **Reference docs** - Each issue links to implementation guides
4. **Check acceptance criteria** - Clear definition of "done"
5. **Update regularly** - Comment on issues with progress updates

## Troubleshooting

**Error: "gh: command not found"**
- Install GitHub CLI and restart your terminal

**Error: "Not authenticated"**
- Run `gh auth login` and follow authentication steps

**Error: "Repository not found"**
- Update `$REPO` variable to match your GitHub repository

**Want to delete all issues and start over?**
```powershell
# List all open issues
gh issue list

# Close specific issue
gh issue close ISSUE_NUMBER
```

## Next Steps

1. ✅ Create issues with the script
2. Review and adjust priorities
3. Assign issues to Jules
4. Set up project board for tracking
5. Start with high-priority Supabase integration!

---

**Questions?** Check the [GitHub CLI documentation](https://cli.github.com/manual/) or [GitHub Issues guide](https://docs.github.com/en/issues).
