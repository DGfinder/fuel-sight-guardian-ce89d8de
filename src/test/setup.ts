import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './mocks/server'

// Start MSW server for API mocking
beforeAll(() => server.listen())

// Clean up after each test
afterEach(() => {
  cleanup()
  server.resetHandlers()
})

// Stop MSW server after all tests
afterAll(() => server.close())