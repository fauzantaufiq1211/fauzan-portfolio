module.exports = {
  testEnvironment: 'node',
  transformIgnorePatterns: [
    '/node_modules/(?!(@exodus/bytes|jsdom|parse5|html-encoding-sniffer|whatwg-url|whatwg-encoding|is-potential-custom-element-name)/)'
  ]
};
