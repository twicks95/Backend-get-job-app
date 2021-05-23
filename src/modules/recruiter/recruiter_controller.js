const helper = require('../../helpers/wrapper')
const recruiterModel = require('./recruiter_model')
const fs = require('fs')
const redis = require('redis')
const client = redis.createClient()
const nodemailer = require('nodemailer')
require('dotenv').config()
const bcrypt = require('bcrypt')

module.exports = {
  sendEmail: async (req, res) => {
    try {
      const { workerId } = req.query
      const { subject, message } = req.body
      const checkIdWorker = await recruiterModel.getWorkerById({
        worker_id: workerId
      })
      if (checkIdWorker.length > 0) {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false, // true for 465, false for other ports
          auth: {
            user: process.env.SMTP_EMAIL, // generated ethereal user
            pass: process.env.SMTP_PASSWORD // generated ethereal password
          }
        })
        const mailOptions = {
          from: '"Jobshall" <jobshallproject@gmail.com>', // sender address
          to: checkIdWorker[0].worker_email, // list of receivers
          subject: subject, // Subject line
          html: message // html body
        }
        await transporter.sendMail(mailOptions, function (error, info) {
          if (error) {
            console.log(error)
            return helper.response(res, 400, 'Email not send !')
          } else {
            console.log('Email sent:' + info.response)
            return helper.response(res, 200, ' Email Sent')
          }
        })
      } else {
        return helper.response(res, 404, `Data By id: ${workerId} Not Found`)
      }
    } catch (error) {
      return helper.response(res, 400, 'Bad Request', error)
    }
  },
  getRecruiter: async (req, res) => {
    try {
      let { search, page, limit, sort } = req.query
      page = parseInt(page)
      limit = parseInt(limit)
      if (!sort) {
        sort = 'recruiter_name ASC'
      }
      if (!search) {
        search = ''
      }
      if (!limit) {
        limit = 2
      }
      if (!page) {
        page = 1
      }
      const totalData = await recruiterModel.getDataCount()
      const totalDataSearch = await recruiterModel.getDataCount()
      const totalPage = Math.ceil(totalData / limit)
      const offset = page * limit - limit
      const pageInfo = {
        page,
        totalPage,
        limit,
        totalData,
        totalDataSearch
      }
      const result = await recruiterModel.getDataAll(
        search,
        sort,
        limit,
        offset
      )

      if (result.length > 0) {
        client.setex(
          `getrecruiter:${JSON.stringify(req.query)}`,
          3600,
          JSON.stringify({ result, pageInfo })
        )
        return helper.response(
          res,
          200,
          `Succes Get, Search , and Sort by ${sort}`,
          result,
          pageInfo
        )
      } else {
        return helper.response(res, 404, 'Data Not Found . . .', null, pageInfo)
      }
    } catch (error) {
      return helper.response(res, 400, 'Bad Request', error)
    }
  },
  getRecruiterById: async (req, res) => {
    try {
      const { id } = req.params
      const result = await recruiterModel.getDataById(id)
      if (result.length > 0) {
        client.set(`getrecruiter:${id}`, JSON.stringify(result))
        return helper.response(res, 200, 'Success Get Data By Id', result)
      } else {
        return helper.response(res, 404, 'Data By id .... Not Found !', null)
      }
    } catch (error) {
      return helper.response(res, 400, 'Bad Request', error)
    }
  },
  updateRecruiter: async (req, res) => {
    try {
      const { id } = req.params

      const {
        recruiterName,
        recruiterDomicile,
        recruiterEmail,
        recruiterIG,
        recruiterLinked,
        recruiterPhone,
        recruiterCompany,
        recruiterFieldCompany,
        recruiterDesc
      } = req.body

      const setData = {
        recruiter_name: recruiterName,
        recruiter_domicile: recruiterDomicile,
        recruiter_email: recruiterEmail,
        recruiter_instagram: recruiterIG,
        recruiter_linked_id: recruiterLinked,
        recruiter_phone: recruiterPhone,
        recruiter_company: recruiterCompany,
        recruiter_field_company: recruiterFieldCompany,
        recruiter_description: recruiterDesc,
        recruiter_image: req.file ? req.file.filename : '',
        recruiter_updated_at: new Date(Date.now())
      }

      const initialResult = await recruiterModel.getDataById(id)
      const result = await recruiterModel.updateData(setData, id)
      if (initialResult.length > 0) {
        fs.stat(
          `src/uploads/${initialResult[0].recruiter_image}`,
          function (err, stats) {
            if (err) {
              return console.error(err)
            }
            fs.unlink(
              `src/uploads/${initialResult[0].recruiter_image}`,
              function (err) {
                if (err) return console.log(err)
                console.log('file deleted successfully')
              }
            )
          }
        )

        return helper.response(res, 200, 'Success Update By Id', result)
      } else {
        return helper.response(res, 404, `Data id ${id} Not Found`, null)
      }
    } catch (error) {
      return helper.response(res, 400, 'Bad Request', error)
    }
  },

  updateRecruiterPassword: async (req, res) => {
    try {
      const { id } = req.params
      const { newPassword, confirmPassword } = req.body
      const salt = bcrypt.genSaltSync(10)

      const dataToDelete = await recruiterModel.getDataById(id)
      const isPasswordConfirmed = newPassword === confirmPassword
      if (dataToDelete.length > 0 && isPasswordConfirmed) {
        const encryptedPassword = bcrypt.hashSync(newPassword, salt)
        const setData = {
          recruiter_password: encryptedPassword,
          recruiter_updated_at: new Date(Date.now())
        }

        const result = await recruiterModel.updateData(setData, id)
        delete result.recruiter_password

        return helper.response(
          res,
          200,
          'Success Update Recruiter Password',
          result
        )
      } else if (!isPasswordConfirmed) {
        return helper.response(
          res,
          401,
          "New And Confirm Password Didn't Match"
        )
      } else {
        return helper.response(res, 404, 'Failed! No Data Is Updated')
      }
    } catch (error) {
      return helper.response(res, 400, 'Bad Request', error)
    }
  },

  deleteRecruiter: async (req, res) => {
    try {
      const { id } = req.params
      const initialResult = await recruiterModel.getDataById(id)
      console.log(initialResult[0].recruiter_image)
      if (initialResult.length > 0) {
        console.log(`Delete data by id = ${id}`)
        const result = await recruiterModel.deleteData(id)
        fs.stat(
          `src/uploads/${initialResult[0].recruiter_image}`,
          function (err, stats) {
            console.log(stats)
            if (err) {
              return console.error(err)
            }
            fs.unlink(
              `src/uploads/${initialResult[0].recruiter_image}`,
              function (err) {
                if (err) return console.log(err)
                console.log('file delected succesfuly')
              }
            )
          }
        )

        return helper.response(res, 200, 'Success Delete By Id', result)
      } else {
        return helper.response(res, 404, 'Data By id .... Not Found !', null)
      }
    } catch (error) {
      return helper.response(res, 400, 'Bad Request', error)
    }
  }
}
