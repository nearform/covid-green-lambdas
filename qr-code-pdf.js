const fs = require('fs')
const AWS = require('aws-sdk')
const PDFDocument = require('pdfkit')
const QRCode = require('qrcode')
const { runIfDev, isProduction, getAssetsBucket } = require('./utils')

async function createPDFContent({ qrCode, name, location }) {
  const doc = new PDFDocument({ size: 'A4' })

  doc.image('./pdf-assets/header.png', 0, 0, { width: doc.page.width })

  doc
    .font('Helvetica-Bold', 18)
    .text(name, (doc.page.width - doc.page.width) / 2, 305, {
      align: 'center',
      width: doc.page.width
    })

  doc.image(qrCode, (doc.page.width - 400) / 2, 330, { width: 400 })

  doc
    .font('Helvetica-Bold', 18)
    .text(location, (doc.page.width - doc.page.width) / 2, 740, {
      align: 'center',
      width: doc.page.width
    })

  doc.image(
    './pdf-assets/footer.png',
    (doc.page.width - (doc.page.width - 50)) / 2,
    doc.page.height - 75,
    {
      width: doc.page.width - 50
    }
  )

  return doc
}

function savePdfToFile(pdf, fileName) {
  return new Promise((resolve, reject) => {
    let pendingStepCount = 2

    // ensure both the stream has been closed and the pdf has been ended
    const stepFinished = () => {
      pendingStepCount = pendingStepCount - 1
      if (pendingStepCount === 0) {
        resolve()
      }
    }

    const writeStream = fs.createWriteStream(fileName)
    writeStream.on('close', stepFinished)
    pdf.pipe(writeStream)

    pdf.end()

    stepFinished()
  })
}

// @TODO - remove default arguments, currently only used for testing
exports.handler = async function({
  id = '5d1d75d9-0ab5-4b28-7e72-5d20f977865f_5Y9969J0',
  token = 'UKC19TRACING:1:eyJhbGciOiJFUzI1NiIsImtpZCI6IllycWVMVHE4ei1vZkg1bnpsYVNHbllSZkI5YnU5eVBsV1lVXzJiNnFYT1EifQ.eyJpZCI6IjVWOVBXVjlSIiwib3BuIjoiRmFjZSBvZiBCZWF1dHkiLCJ2dCI6IjAwNCIsInBjIjoiTEUxMDBOVyJ9.oAG0uAqZh4BY622xscKd7j3hQOh6R6nziNnrA491LMp_YuKcMYY_VgkLeRgDhizAkjke63CURxZZ8SE4b0lARg',
  name = 'Venue Name',
  location = 'Venue Address, Postcode'
}) {
  if (!id || !token || !name || !location) {
    console.log('Missing required argument')
    return false
  }

  try {
    const qrCode = await QRCode.toDataURL(token, { margin: 0 })
    const doc = await createPDFContent({ qrCode, name, location })

    if (isProduction) {
      // @TODO - test out this workflow once we have the infra set up, currently untested
      const s3 = new AWS.S3({ region: process.env.AWS_REGION })
      const bucket = await getAssetsBucket()

      s3.upload(
        {
          key: `${id}.pdf`,
          body: doc,
          bucket: bucket,
          contentType: 'application/pdf'
        },
        (err, response) => console.log(err, response)
      )
    } else {
      await savePdfToFile(doc, `pdf-assets/${id}.pdf`)
      return true
    }
  } catch (error) {
    console.log(error)
    return false
  }
}

runIfDev(exports.handler)
