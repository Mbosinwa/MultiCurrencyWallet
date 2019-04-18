import baseConfig from './default'
import config from './mainnet'


export default {
  env: 'production',
  entry: 'mainnet',
  local: 'online',
  dir: 'mainnet',

  base: 'https://swap.online/',
  publicPath: `https://justescrow.io${baseConfig.publicPath}`,

  ...config,
}
