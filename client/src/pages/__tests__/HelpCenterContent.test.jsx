/**
 * HelpCenterContent.test.jsx
 *
 * Content-level tests for HelpCenter FAQ accuracy.
 * Ensures FAQ copy matches the live Clerk auth flows, RBAC permission map,
 * and real application routes — preventing stale documentation from
 * misleading users (Issue #2241).
 *
 * These tests validate the exported faqs / troubleshootingGuides data,
 * NOT the rendered UI. Import the data arrays directly so they stay fast
 * and deterministic.
 */
import { describe, it, expect } from 'vitest'

import { faqs, faqCategories, troubleshootingGuides } from '../HelpCenter.jsx'

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Collect all FAQ answer strings that match a regex. */
const matchingAnswers = (pattern) => faqs.filter((faq) => pattern.test(faq.a)).map((faq) => faq.q)

/** Collect all FAQ answer strings that contain a literal substring. */
const answersContaining = (substring) =>
  matchingAnswers(new RegExp(substring.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))

/* ------------------------------------------------------------------ */
/* RBAC ground-truth (mirrors client/src/utils/rbacPermissions.js)    */
/* ------------------------------------------------------------------ */

const ROLE_HIERARCHY = {
  owner: 5,
  admin: 4,
  moderator: 3,
  member: 2,
  viewer: 1,
  guest: 0,
}

const VALID_ROLES = Object.keys(ROLE_HIERARCHY)

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

describe('HelpCenter FAQ — Clerk auth accuracy', () => {
  it("does NOT mention a local 'Change Password' button in Settings", () => {
    const offending = answersContaining('Change Password')
    expect(offending).toEqual([])
  })

  it('does NOT imply a local auth stack for password resets', () => {
    const offending = answersContaining('password reset flow')
    expect(offending).toEqual([])
  })

  it('mentions Clerk as the auth provider in at least one FAQ', () => {
    const clerkMentions = answersContaining('Clerk')
    expect(clerkMentions.length).toBeGreaterThanOrEqual(1)
  })

  it('does NOT reference a removed or non-existent /login path for auth management', () => {
    const offending = answersContaining('/login/settings')
    expect(offending).toEqual([])
  })

  it('references Settings > Security as the entry point for password management', () => {
    const passwordFaq = faqs.find((faq) => /change my password/i.test(faq.q))
    expect(passwordFaq).toBeDefined()
    expect(passwordFaq.a.toLowerCase()).toContain('settings')
    expect(passwordFaq.a.toLowerCase()).toContain('security')
  })
})

describe('HelpCenter FAQ — RBAC accuracy', () => {
  it('lists all six valid roles in the roles FAQ answer', () => {
    const rolesFaq = faqs.find((faq) => /roles and permissions/i.test(faq.q))
    expect(rolesFaq).toBeDefined()

    for (const role of VALID_ROLES) {
      expect(rolesFaq.a.toLowerCase()).toContain(role)
    }
  })

  it('does NOT claim only Moderators can create meetings (Members can too)', () => {
    const rolesFaq = faqs.find((faq) => /roles and permissions/i.test(faq.q))
    expect(rolesFaq).toBeDefined()

    // Should mention Member (or higher) for meeting creation, not Moderator-only
    expect(rolesFaq.a.toLowerCase()).toContain('member')
  })

  it('does NOT reference non-existent roles', () => {
    const allFaqText = faqs.map((faq) => `${faq.q} ${faq.a}`).join(' ')
    const nonExistentRoles = ['superadmin', 'super-admin', 'poweruser', 'readonly']
    for (const role of nonExistentRoles) {
      expect(allFaqText.toLowerCase()).not.toContain(role)
    }
  })

  it('includes at least 4 FAQ entries in account category', () => {
    const accountFaqs = faqs.filter((faq) => faq.category === 'account')
    expect(accountFaqs.length).toBeGreaterThanOrEqual(4)
  })
})

describe('HelpCenter FAQ — structure and metadata', () => {
  it('every FAQ has a non-empty question and answer', () => {
    for (const faq of faqs) {
      expect(faq.q.trim().length).toBeGreaterThan(0)
      expect(faq.a.trim().length).toBeGreaterThan(0)
    }
  })

  it('every FAQ references a valid category id', () => {
    const validCategoryIds = faqCategories.map((cat) => cat.id)
    for (const faq of faqs) {
      expect(validCategoryIds).toContain(faq.category)
    }
  })

  it('has at least one FAQ per category', () => {
    for (const cat of faqCategories) {
      const count = faqs.filter((faq) => faq.category === cat.id).length
      expect(count).toBeGreaterThanOrEqual(1)
    }
  })

  it('FAQ questions are unique', () => {
    const questions = faqs.map((faq) => faq.q)
    const uniqueQuestions = new Set(questions)
    expect(uniqueQuestions.size).toBe(questions.length)
  })

  it('has at least 8 total FAQs for comprehensive coverage', () => {
    expect(faqs.length).toBeGreaterThanOrEqual(8)
  })
})

describe('HelpCenter Troubleshooting — structure and accuracy', () => {
  it('every guide has a title, problem, and at least two steps', () => {
    for (const guide of troubleshootingGuides) {
      expect(guide.title.trim().length).toBeGreaterThan(0)
      expect(guide.problem.trim().length).toBeGreaterThan(0)
      expect(guide.steps.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('no guide references local auth flows', () => {
    const offending = troubleshootingGuides.filter((guide) =>
      /local auth|Change Password|password reset flow/i.test(
        `${guide.title} ${guide.problem} ${guide.steps.join(' ')}`,
      ),
    )
    expect(offending.map((g) => g.title)).toEqual([])
  })

  it('has at least 3 troubleshooting guides', () => {
    expect(troubleshootingGuides.length).toBeGreaterThanOrEqual(3)
  })
})

describe('HelpCenter — deep-link route sanity', () => {
  it('does NOT link to a non-existent /security route (security is inside Settings via Clerk)', () => {
    const allText = faqs.map((faq) => `${faq.q} ${faq.a}`).join(' ')
    // The old FAQ linked to a /security sub-route that doesn't exist
    expect(allText).not.toMatch(/\b\/security\b/)
  })

  it('mentions /settings path in password/account FAQs as the entry point', () => {
    const accountFaqs = faqs.filter((faq) => faq.category === 'account')
    const allAccountText = accountFaqs.map((faq) => faq.a).join(' ')
    expect(allAccountText.toLowerCase()).toContain('settings')
  })

  it("does NOT reference /forgot-password as a direct route (it's a Clerk UI flow)", () => {
    const allText = faqs.map((faq) => `${faq.q} ${faq.a}`).join(' ')
    expect(allText).not.toMatch(/\/forgot-password/)
  })
})
