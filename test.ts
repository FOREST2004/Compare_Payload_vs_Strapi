import fs from 'fs'
import path from 'path'

require('isomorphic-fetch')

const getAverage = arr => arr.reduce((p, c) => p + c, 0) / arr.length

const [platform] = process.argv.slice(2)
// const query = fs.readFileSync(path.resolve(__dirname, platform, 'query.graphql'), 'utf8')

const main = async () => {
  let authHeader
  let performQuery
  if (platform === 'payload') {
    authHeader = await getPayloadAuthHeader()
    // performQuery = async () => await performPayloadQuery(authHeader, query)
    performQuery = async () => await performPayloadRestQuery(authHeader)
  } else if (platform === 'strapi') {
    authHeader = await getStrapiAuthHeader()
    // performQuery = async () => await performStrapiQuery(authHeader, query)
    performQuery = async () => await performStrapiRestQuery(authHeader)
  } else {
    throw new Error(`Unknown platform: ${platform}`)
  }

  const startTime = new Date().getTime()
  const fetchTimes: number[] = []

  await [...Array(100)].reduce(async (priorFetch, _, i) => {
    await priorFetch
    const sendDate = new Date().getTime()

    await performQuery()
    const receiveDate = new Date().getTime()
    const completionTime = receiveDate - sendDate

    console.log(`Request ${i + 1} completed in ${completionTime}ms`)
    fetchTimes.push(completionTime)
  }, Promise.resolve())

  const endTime = new Date().getTime()
  const totalTestTime = endTime - startTime

  const average = getAverage(fetchTimes)
  const max = Math.max(...fetchTimes)
  const min = Math.min(...fetchTimes)

  console.log(`Performance test completed in ${totalTestTime}ms`)
  console.log(`Average response time: ${average}ms`)
  console.log(`Max response time: ${max}ms`)
  console.log(`Min response time: ${min}ms`)

  fs.writeFileSync(
    `results-${platform}.json`,
    JSON.stringify({ average, max, min, totalTestTime }),
    'utf8',
  )
}

main()

// Auth
async function getPayloadAuthHeader() {
  const res = await fetch('http://127.0.0.1:3000/api/users/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'dev@payloadcms.com',
      password: 'test',
    }),
  })
  const { token } = await res.json()
  console.log('Payload token:', token)
  return `JWT ${token}`
}

async function getStrapiAuthHeader() {
  const res = await fetch('http://127.0.0.1:1337/api/auth/local', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identifier: 'user@user.com',
      password: 'Test123123',
    }),
  })
  const { jwt } = await res.json()
  console.log('Strapi token:', jwt)
  return `Bearer ${jwt}`
}

// GraphQL Queries (commented out)
// async function performPayloadQuery(authHeader: string, query: string) {
//   await fetch('http://127.0.0.1:3000/api/graphql', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: authHeader,
//     },
//     body: JSON.stringify({
//       query,
//     }),
//   })
// }
//
// async function performStrapiQuery(authHeader: string, query: string) {
//   await fetch('http://127.0.0.1:1337/graphql', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: authHeader,
//     },
//     body: JSON.stringify({
//       query,
//     }),
//   })
// }

// REST Queries
async function performPayloadRestQuery(authHeader: string) {
  await fetch('http://127.0.0.1:3000/api/documents?depth=2', {
    method: 'GET',
    headers: {
      Authorization: authHeader,
    },
  })
}

async function performStrapiRestQuery(authHeader: string) {
  const params = [
    'populate[relationship_as][populate][relationship_b]=*',
    'populate[blocks][populate][relationship_a][populate][relationship_b]=*',
    'populate[blocks][populate][relationship_as][populate][relationship_b]=*',
    'populate[Group][populate][NestedGroup]=*',
    'populate[array][populate][NestedArray][populate][relationship_a][populate][relationship_b]=*',
  ].join('&')

  await fetch(`http://127.0.0.1:1337/api/documents?${params}`, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
    },
  })
}