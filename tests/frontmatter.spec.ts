import { describe, expect, it } from 'vitest'
import {
  findClosingFrontmatter,
  frontmatterBoolean,
  optionalMetadata,
  optionalString,
  parseFrontmatter,
  parseInvocationPolicy,
  stringField,
} from '../src/frontmatter.ts'

describe('parseFrontmatter', () => {
  it('returns the parsed data and remaining body for a well-formed block', () => {
    const parsed = parseFrontmatter('---\nname: a\n---\nbody text\n')
    expect(parsed).toEqual({ data: { name: 'a' }, body: 'body text\n' })
  })

  it('splits the body right after the closing delimiter with no trailing newline', () => {
    const parsed = parseFrontmatter('---\nname: a\n---')
    expect(parsed).toEqual({ data: { name: 'a' }, body: '' })
  })

  it('returns undefined when there is no newline at all', () => {
    expect(parseFrontmatter('just text')).toBeUndefined()
  })

  it('returns undefined when the first line is not the opening delimiter', () => {
    expect(parseFrontmatter('not---\nname: a\n---\nbody')).toBeUndefined()
  })

  it('returns undefined when the block never closes', () => {
    expect(parseFrontmatter('---\nname: a')).toBeUndefined()
  })

  it('returns undefined when the YAML is not an object', () => {
    expect(parseFrontmatter('---\n- a\n- b\n---\nbody')).toBeUndefined()
    expect(parseFrontmatter('---\njust a string\n---\nbody')).toBeUndefined()
    expect(parseFrontmatter('---\n\n---\nbody')).toBeUndefined()
  })
})

describe('findClosingFrontmatter', () => {
  it('locates a closing delimiter line and the body start after its newline', () => {
    expect(findClosingFrontmatter('name: a\n---\nbody', 0)).toEqual({ start: 8, bodyStart: 12 })
  })

  it('treats a closing delimiter at end-of-file as an empty body', () => {
    expect(findClosingFrontmatter('name: a\n---', 0)).toEqual({ start: 8, bodyStart: 11 })
  })

  it('returns undefined when no closing delimiter line exists', () => {
    expect(findClosingFrontmatter('name: a', 0)).toBeUndefined()
  })
})

describe('stringField', () => {
  it('returns a non-empty string value', () => {
    expect(stringField({ name: 'x' }, 'name')).toBe('x')
  })

  it('returns undefined for a non-string value', () => {
    expect(stringField({ name: 7 }, 'name')).toBeUndefined()
  })

  it('returns undefined for an empty string', () => {
    expect(stringField({ name: '' }, 'name')).toBeUndefined()
  })

  it('returns undefined for an absent key', () => {
    expect(stringField({}, 'name')).toBeUndefined()
  })
})

describe('optionalString', () => {
  it('wraps a non-empty string as the whenToUse property', () => {
    expect(optionalString({ whenToUse: 'guide' }, 'whenToUse')).toEqual({ whenToUse: 'guide' })
  })

  it('omits the property when the value is absent or empty', () => {
    expect(optionalString({}, 'whenToUse')).toEqual({})
    expect(optionalString({ whenToUse: '' }, 'whenToUse')).toEqual({})
  })
})

describe('optionalMetadata', () => {
  it('wraps a plain object metadata value', () => {
    expect(optionalMetadata({ metadata: { tags: ['a'] } })).toEqual({ metadata: { tags: ['a'] } })
  })

  it('omits metadata for null, arrays, and non-object values', () => {
    expect(optionalMetadata({ metadata: null })).toEqual({})
    expect(optionalMetadata({ metadata: ['a'] })).toEqual({})
    expect(optionalMetadata({ metadata: 'text' })).toEqual({})
  })
})

describe('frontmatterBoolean', () => {
  it('returns undefined for an absent key', () => {
    expect(frontmatterBoolean({}, 'disable-model-invocation')).toBeUndefined()
  })

  it('returns a boolean value as-is', () => {
    expect(frontmatterBoolean({ 'disable-model-invocation': true }, 'disable-model-invocation')).toBe(true)
    expect(frontmatterBoolean({ 'user-invocable': false }, 'user-invocable')).toBe(false)
  })

  it('throws for a non-boolean value', () => {
    expect(() => frontmatterBoolean({ 'user-invocable': 'yes' }, 'user-invocable')).toThrow(/must be a boolean/)
  })
})

describe('parseInvocationPolicy', () => {
  it('defaults both surfaces to invocable when the keys are absent', () => {
    expect(parseInvocationPolicy({})).toEqual({ modelInvocable: true, userInvocable: true })
  })

  it('disables model invocation only when the disable flag is true', () => {
    expect(parseInvocationPolicy({ 'disable-model-invocation': true })).toEqual({
      modelInvocable: false,
      userInvocable: true,
    })
    expect(parseInvocationPolicy({ 'disable-model-invocation': false })).toEqual({
      modelInvocable: true,
      userInvocable: true,
    })
  })

  it('disables user invocation only when the user-invocable flag is false', () => {
    expect(parseInvocationPolicy({ 'user-invocable': false })).toEqual({
      modelInvocable: true,
      userInvocable: false,
    })
    expect(parseInvocationPolicy({ 'user-invocable': true })).toEqual({
      modelInvocable: true,
      userInvocable: true,
    })
  })
})
