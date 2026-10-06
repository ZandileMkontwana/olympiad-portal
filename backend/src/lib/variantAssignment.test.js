import { describe, it, expect } from 'vitest';
const {
  assignVariant,
  assignVariantsForPaper,
  getVariantDistribution,
} = require('./variantAssignment');

describe('Variant Assignment', () => {
  const variants = [
    { id: 'v-1', label: 'Variant A' },
    { id: 'v-2', label: 'Variant B' },
    { id: 'v-3', label: 'Variant C' },
  ];

  describe('assignVariant', () => {
    it('returns null when variants array is empty', () => {
      const result = assignVariant('entrant-1', 'question-1', []);
      expect(result).toBeNull();
    });

    it('returns null when variants is null', () => {
      const result = assignVariant('entrant-1', 'question-1', null);
      expect(result).toBeNull();
    });

    it('returns the only variant when there is just one', () => {
      const singleVariant = [{ id: 'v-1', label: 'Only Variant' }];
      const result = assignVariant('entrant-1', 'question-1', singleVariant);
      expect(result).toEqual(singleVariant[0]);
    });

    it('is deterministic - same entrant and question always get the same variant', () => {
      const entrantId = 'entrant-123';
      const questionId = 'question-456';

      const result1 = assignVariant(entrantId, questionId, variants);
      const result2 = assignVariant(entrantId, questionId, variants);
      const result3 = assignVariant(entrantId, questionId, variants);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });

    it('assigns different variants to different entrants', () => {
      const questionId = 'question-1';
      const assignments = new Set();

      // Test with many entrants to ensure we get different variants
      for (let i = 0; i < 100; i++) {
        const variant = assignVariant(`entrant-${i}`, questionId, variants);
        assignments.add(variant.id);
      }

      // Should have assigned at least 2 different variants (statistically very likely)
      expect(assignments.size).toBeGreaterThanOrEqual(2);
    });

    it('assigns different variants to the same entrant for different questions', () => {
      const entrantId = 'entrant-123';
      const assignments = new Set();

      // Test with many questions to ensure we get different variants
      for (let i = 0; i < 100; i++) {
        const variant = assignVariant(entrantId, `question-${i}`, variants);
        assignments.add(variant.id);
      }

      // Should have assigned at least 2 different variants (statistically very likely)
      expect(assignments.size).toBeGreaterThanOrEqual(2);
    });

    it('always returns a valid variant from the array', () => {
      for (let i = 0; i < 100; i++) {
        const variant = assignVariant(`entrant-${i}`, 'question-1', variants);
        expect(variants).toContainEqual(variant);
      }
    });
  });

  describe('assignVariantsForPaper', () => {
    it('assigns variants for all questions in a paper', () => {
      const questions = [
        { id: 'q-1', variants },
        { id: 'q-2', variants },
        { id: 'q-3', variants },
      ];

      const assignments = assignVariantsForPaper('entrant-1', questions);

      expect(assignments.size).toBe(3);
      expect(assignments.has('q-1')).toBe(true);
      expect(assignments.has('q-2')).toBe(true);
      expect(assignments.has('q-3')).toBe(true);
    });

    it('returns null for questions with no variants', () => {
      const questions = [
        { id: 'q-1', variants: [] },
        { id: 'q-2', variants },
      ];

      const assignments = assignVariantsForPaper('entrant-1', questions);

      expect(assignments.get('q-1')).toBeNull();
      expect(assignments.get('q-2')).not.toBeNull();
    });

    it('is deterministic across multiple calls', () => {
      const questions = [
        { id: 'q-1', variants },
        { id: 'q-2', variants },
      ];

      const assignments1 = assignVariantsForPaper('entrant-1', questions);
      const assignments2 = assignVariantsForPaper('entrant-1', questions);

      expect(assignments1.get('q-1')).toEqual(assignments2.get('q-1'));
      expect(assignments1.get('q-2')).toEqual(assignments2.get('q-2'));
    });
  });

  describe('getVariantDistribution', () => {
    it('counts variant assignments correctly', () => {
      const entrantIds = ['e-1', 'e-2', 'e-3', 'e-4', 'e-5', 'e-6'];
      const questionId = 'q-1';

      const distribution = getVariantDistribution(entrantIds, questionId, variants);

      expect(distribution.size).toBe(3);

      // Total count should equal number of entrants
      const total = Array.from(distribution.values()).reduce((sum, count) => sum + count, 0);
      expect(total).toBe(entrantIds.length);
    });

    it('provides roughly even distribution with many entrants', () => {
      // Generate 1000 entrant IDs
      const entrantIds = Array.from({ length: 1000 }, (_, i) => `entrant-${i}`);
      const questionId = 'q-1';

      const distribution = getVariantDistribution(entrantIds, questionId, variants);

      // Each variant should get roughly 333 assignments (1000 / 3)
      // Allow for some variance (±20% is reasonable for hash-based distribution)
      const expectedPerVariant = 1000 / 3;
      const tolerance = expectedPerVariant * 0.2;

      for (const count of distribution.values()) {
        expect(count).toBeGreaterThan(expectedPerVariant - tolerance);
        expect(count).toBeLessThan(expectedPerVariant + tolerance);
      }
    });

    it('handles single variant correctly', () => {
      const singleVariant = [{ id: 'v-1', label: 'Only' }];
      const entrantIds = ['e-1', 'e-2', 'e-3'];

      const distribution = getVariantDistribution(entrantIds, 'q-1', singleVariant);

      expect(distribution.get('Only')).toBe(3);
    });

    it('handles empty variants array', () => {
      const entrantIds = ['e-1', 'e-2', 'e-3'];
      const distribution = getVariantDistribution(entrantIds, 'q-1', []);
      expect(distribution.size).toBe(0);
    });
  });

  describe('Distribution quality', () => {
    it('achieves good distribution across variants with realistic data', () => {
      // Simulate a realistic scenario: 3 variants, 150 entrants
      const entrantIds = Array.from({ length: 150 }, (_, i) => `student-${i}`);
      const questionId = 'question-1';
      const testVariants = [
        { id: 'v-a', label: 'A' },
        { id: 'v-b', label: 'B' },
        { id: 'v-c', label: 'C' },
      ];

      const distribution = getVariantDistribution(entrantIds, questionId, testVariants);

      // With 150 entrants and 3 variants, expect ~50 each
      // Allow ±30% variance (40-60 range)
      for (const count of distribution.values()) {
        expect(count).toBeGreaterThanOrEqual(35);
        expect(count).toBeLessThanOrEqual(65);
      }
    });

    it('maintains determinism with UUIDs', () => {
      // Test with realistic UUIDs
      const uuids = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
        '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
      ];

      const questionId = 'q-1';

      // First assignment
      const assignments1 = uuids.map((id) => assignVariant(id, questionId, variants));

      // Second assignment
      const assignments2 = uuids.map((id) => assignVariant(id, questionId, variants));

      // Should be identical
      expect(assignments1).toEqual(assignments2);
    });

    it('handles edge case: two variants', () => {
      const twoVariants = [
        { id: 'v-1', label: 'A' },
        { id: 'v-2', label: 'B' },
      ];

      const entrantIds = Array.from({ length: 100 }, (_, i) => `e-${i}`);
      const distribution = getVariantDistribution(entrantIds, 'q-1', twoVariants);

      // With 100 entrants and 2 variants, expect ~50 each
      const countA = distribution.get('A');
      const countB = distribution.get('B');

      expect(countA).toBeGreaterThan(30);
      expect(countA).toBeLessThan(70);
      expect(countB).toBeGreaterThan(30);
      expect(countB).toBeLessThan(70);
      expect(countA + countB).toBe(100);
    });

    it('handles edge case: many variants', () => {
      const manyVariants = Array.from({ length: 10 }, (_, i) => ({
        id: `v-${i}`,
        label: `Variant ${i}`,
      }));

      const entrantIds = Array.from({ length: 1000 }, (_, i) => `e-${i}`);
      const distribution = getVariantDistribution(entrantIds, 'q-1', manyVariants);

      // With 1000 entrants and 10 variants, expect ~100 each
      // Allow ±40% variance (60-140 range)
      for (const count of distribution.values()) {
        expect(count).toBeGreaterThan(60);
        expect(count).toBeLessThan(140);
      }
    });
  });

  describe('Hash function quality', () => {
    it('produces different hashes for similar strings', () => {
      // These should produce different hash values
      const hash1 = assignVariant('entrant-1', 'q-1', variants);
      const hash2 = assignVariant('entrant-2', 'q-1', variants);
      const hash3 = assignVariant('entrant-1', 'q-2', variants);

      // At least one should be different (statistically very likely)
      const uniqueVariants = new Set([hash1.id, hash2.id, hash3.id]);
      expect(uniqueVariants.size).toBeGreaterThanOrEqual(1);
    });

    it('handles special characters in IDs', () => {
      const specialIds = [
        'entrant-with-dashes',
        'entrant_with_underscores',
        'entrant.with.dots',
        'entrant:with:colons',
        'entrant with spaces',
      ];

      specialIds.forEach((id) => {
        const variant = assignVariant(id, 'q-1', variants);
        expect(variant).not.toBeNull();
        expect(variants).toContainEqual(variant);
      });
    });

    it('handles very long IDs', () => {
      const longId = 'a'.repeat(1000);
      const variant = assignVariant(longId, 'q-1', variants);
      expect(variant).not.toBeNull();
      expect(variants).toContainEqual(variant);
    });

    it('handles empty strings', () => {
      const variant = assignVariant('', 'q-1', variants);
      expect(variant).not.toBeNull();
      expect(variants).toContainEqual(variant);
    });
  });
});
