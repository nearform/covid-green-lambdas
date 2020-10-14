const AWS = require('aws-sdk')
const PDFDocument = require('pdfkit')
const QRCode = require('qrcode')
const { runIfDev } = require('./utils')

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

exports.handler = async function(event) {
  const { bucketName, id, location, name, token } = event
  const s3 = new AWS.S3({ region: process.env.AWS_REGION })
  const qrCode = await QRCode.toDataURL(token)

  if (bucketName) {
    await s3.upload({
      key: `${id}.pdf`,
      body: await createPDFContent({ qrCode, name, location }),
      bucket: bucketName,
      contentType: 'application/pdf'
    })
  }
}

runIfDev(exports.handler)
