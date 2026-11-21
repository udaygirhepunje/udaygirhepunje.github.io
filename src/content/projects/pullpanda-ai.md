---
title: PullPanda AI
summary: An automated GitHub code-review agent built with the Probot framework
  and LLMs to review pull requests and reduce review fatigue.
role: Team lead and developer
problem: Engineering teams spend substantial time catching repetitive syntax and
  convention errors across pull requests, slowing delivery.
outcome: Deployed across 26+ enterprise repositories, analyzing over 5,150 pull
  requests with a 50% reduction in false positives.
achievement: 5,150+ pull requests reviewed
technologies:
  - TypeScript
  - Node.js
  - Probot
  - LLMs
  - GitHub API
links:
  - label: Github Marketplace
    url: https://github.com/apps/pullpanda-ai
  - label: GitHub
    url: https://github.com/udaygirhepunje/PullPandaAI
featured: true
hidden: false
order: 3
---
I developed PullPanda as a GitHub application using the Probot framework to automate pull request code reviews.

The agent evaluates diffs against team conventions, enforces PR change-size boundaries, validates issue tracking metadata, and posts actionable feedback. Installed across 26+ enterprise repositories, it has reviewed more than 5,150 pull requests, cutting false positive review comments by 50% through iterative prompt tuning.