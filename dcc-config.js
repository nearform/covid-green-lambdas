const axios = require('axios')
const https = require('https')
const { Certificate } = require('@fidm/x509')
const ECKey = require('ec-key')
const valueSets = require('./dcc/valueSets.json')
const valueSetsComputed = require('./dcc/valueSetsComputed.json')
const locations = require('./dcc/locations.json')
const rules = require('./dcc/rules.json')
const AWS = require('aws-sdk')

const { getDGCConfig, runIfDev, getAssetsBucket } = require('./utils')

async function getTrustedCerts(config) {
  const { auth, url } = config

  console.log(`beginning downloading trusted cerst from DGC ${url}`)

  const httpsAgent = new https.Agent({
    cert: Buffer.from(auth.cert, 'utf-8'),
    key: Buffer.from(auth.key, 'utf-8')
  })

  const headers = {
    Accept: '*/*'
  }

  try {
    const result = await axios.get(`${url}/trustList/DSC`, {
      headers,
      httpsAgent
    })

    if (result.data) {
      return result.data
        .map((i) => {
          try {
            const cert = Certificate.fromPEM(
              `-----BEGIN CERTIFICATE-----\n${i.rawData}\n-----END CERTIFICATE-----`
            )

            const ec = new ECKey(cert.publicKeyRaw, 'spki')
            return {
              kid: i.kid,
              country: i.country,
              x: ec.x.toString('base64'),
              y: ec.y.toString('base64')
            }
          } catch (e) {
            console.log(i.country, i.thumbprint)
            return null
          }
        })
        .filter((i) => i !== null)
    } else {
      throw new Error('No trustList data available')
    }
  } catch (e) {
    console.log(e)
    throw e
  }
}

function getValueSets() {
  return valueSets
}

function getRules() {
  return rules
}

function getLocations() {
  return locations
}

function getValueSetsComputed() {
  return valueSetsComputed
}

async function downloadFromDGC(config) {
  const certs = await getTrustedCerts(config)
  const valueSets = getValueSets()
  const valuesetsComputed = getValueSetsComputed()
  const rules = getRules()
  const locations = getLocations()

  return {
    certs,
    valueSets,
    valuesetsComputed,
    rules,
    locations
  }
}

exports.handler = async function (event) {
  const { dgc } = await getDGCConfig()

  if (!dgc || !dgc.enableDCC) {
    return 'Building DCC Config is not enabled or config not defined correctly'
  }
  console.log(dgc)

  const s3 = new AWS.S3({ region: process.env.AWS_REGION })
  const bucket = await getAssetsBucket()

  if (bucket && dgc) {
    const data = await downloadFromDGC(dgc)

    const statsObject = {
      ACL: 'private',
      Body: Buffer.from(JSON.stringify(data)),
      Bucket: bucket,
      ContentType: 'application/json',
      Key: 'dccconfig.json'
    }

    await s3.putObject(statsObject).promise()

    return data
  }
}

runIfDev(exports.handler)
