const { IncomingMessage } = require('http');
const Query = require('querystring');
const { Stream } = require('stream');

/**
 * This is a compatibility later to replace req/res methods in order to bridge to APIGateway events.
 * @param event
 */
exports.default = (event) => {
  const response = {
    statusCode: 200,
    body: '',
    headers: {}
  }
  let tempResponseBody

  const newStream = new Stream.Readable()
  const req = Object.assign(newStream, IncomingMessage.prototype)

  // TODO: check if 'path' replaces V2 rawPath counterpart
  const { queryStringParameters, path: rawPath } = event
  const qs = queryStringParameters ? Query.stringify(queryStringParameters) : ''

  const hasQueryString = qs.length > 0

  req.url = hasQueryString ? `${rawPath}?${qs}` : rawPath

  req.method = event.requestContext.httpMethod
  req.rawHeaders = []
  req.headers = {}

  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      req.headers[key.toLowerCase()] = value
    }
  }

  req.getHeader = name => {
    return req.headers[name.toLowerCase()]
  }
  req.getHeaders = () => {
    return req.headers
  }
  req.connection = {}

  const res = new Stream()
  Object.defineProperty(res, 'statusCode', {
    get() {
      return response.statusCode
    },
    set(statusCode) {
      response.statusCode = statusCode
    }
  })

  const headerNames = {}
  res.headers = {}
  res.writeHead = (status, headers) => {
    response.statusCode = status
    res.headers = { ...res.headers, ...headers }
  }

  res.write = chunk => {
    // Use tempResponseBody to buffers until needed to convert to base64-encoded
    // string for APIGateway response
    // Otherwise binary data (such as images) can get corrupted
    if (!tempResponseBody) {
      tempResponseBody = Buffer.of()
    }

    tempResponseBody = Buffer.concat([
      tempResponseBody,
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    ])
  }
  res.setHeader = (name, value) => {
    headerNames[name.toLowerCase()] = name
    res.headers[name.toLowerCase()] = value
  }
  res.removeHeader = name => {
    delete res.headers[name.toLowerCase()]
  }
  res.getHeader = name => {
    return res.headers[name.toLowerCase()]
  }
  res.getHeaders = () => {
    return res.headers
  }
  res.hasHeader = name => {
    return !!res.getHeader(name)
  }

  const onResEnd = resolve => chunk => {
    if (chunk) {
      res.write(chunk)
    }
    if (!res.statusCode) {
      res.statusCode = 200
    }

    if (tempResponseBody) {
      response.body = tempResponseBody.toString('base64')
      response.isBase64Encoded = true
    }
    res.writeHead(response.statusCode)

    response.headers = {}
    response.multiValueHeaders = {}
    for (const [key, value] of Object.entries(res.headers)) {
      const headerName = headerNames[key] || key

      if (Array.isArray(value)) {
        response.multiValueHeaders[headerName] = value
      } else {
        response.headers[headerName] = value
      }
    }

    resolve(response)
  }

  const responsePromise = new Promise(resolve => {
    res.end = onResEnd(resolve)
  })

  if (event.body) {
    req.push(event.body, event.isBase64Encoded ? 'base64' : undefined)
  }

  req.push(null)

  return { req, res, responsePromise }
}
