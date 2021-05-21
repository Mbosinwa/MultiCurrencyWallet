import React, { PureComponent } from 'react'

import { connect } from 'redaction'
import actions from 'redux/actions'

import cssModules from 'react-css-modules'
import styles from './Wallet.scss'
import { isMobile } from 'react-device-detect'
import moment from 'moment'

import History from 'pages/History/History'

import helpers, {
  links,
  constants,
  stats
} from 'helpers'
import { localisedUrl } from 'helpers/locale'
import { getActivatedCurrencies } from 'helpers/user'
import getTopLocation from 'helpers/getTopLocation'
import { FormattedMessage, injectIntl } from 'react-intl'

import appConfig from 'app-config'
import config from 'helpers/externalConfig'
import { withRouter } from 'react-router-dom'
import CurrenciesList from './CurrenciesList'
import InvoicesList from 'pages/Invoices/InvoicesList'

import DashboardLayout from 'components/layout/DashboardLayout/DashboardLayout'
import BalanceForm from 'components/BalanceForm/BalanceForm'

import { BigNumber } from 'bignumber.js'
import metamask from 'helpers/metamask'

import wpLogoutModal from 'helpers/wpLogoutModal'
import feedback from 'shared/helpers/feedback'

const isWidgetBuild = config && config.isWidget
const isDark = localStorage.getItem(constants.localStorage.isDark)

@connect(
  ({
    core: { hiddenCoinsList },
    user,
    user: {
      activeFiat,
      ethData,
      bnbData,
      btcData,
      ghostData,
      nextData,
      btcMultisigSMSData,
      btcMultisigUserData,
      btcMultisigUserDataList,
      tokensData,
      isBalanceFetching,
      multisigPendingCount,
      activeCurrency,
      metamaskData,
    },
    currencies: { items: currencies },
    modals,
  }) => {
    return {
      currencies,
      isBalanceFetching,
      multisigPendingCount,
      hiddenCoinsList,
      user,
      activeCurrency,
      activeFiat,
      tokensData: {
        ethData,
        metamaskData: {
          ...metamaskData,
          currency: 'ETH Metamask',
        },
        btcData,
        ghostData,
        nextData,
        btcMultisigSMSData,
        btcMultisigUserData,
        btcMultisigUserDataList,
      },
      modals,
    }
  }
)
@withRouter
@cssModules(styles, { allowMultiple: true })
class Wallet extends PureComponent<any, any> {
  constructor(props) {
    super(props)

    const {
      match: {
        params: { page = null },
      },
      multisigPendingCount,
    } = props

    const allData = actions.core.getWallets({})

    let activeView = 0

    if (page === 'history' && !isMobile) {
      activeView = 1
    }
    if (page === 'invoices') activeView = 2

    this.state = {
      allData,
      activeView,
      btcBalance: 0,
      enabledCurrencies: getActivatedCurrencies(),
      multisigPendingCount,
    }
    //@ts-ignore
    this.syncTimer = null
  }

  handleConnectWallet() {
    const {
      history,
      intl: { locale },
    } = this.props

    if (metamask.isConnected()) {
      history.push(localisedUrl(locale, links.home))
      return
    }

    setTimeout(() => {
      metamask.connect({})
    }, 100)
  }

  componentDidUpdate(prevProps) {
    const {
      match: {
        params: { page = null },
      },
      multisigPendingCount,
      intl,
      intl: { locale },
      location: { pathname },
      history,
    } = this.props

    const {
      location: { pathname: prevPathname },
    } = prevProps

    if (
      pathname.toLowerCase() != prevPathname.toLowerCase() &&
      pathname.toLowerCase() == links.connectWallet.toLowerCase()
    ) {
      this.handleConnectWallet()
    }

    const {
      match: {
        params: { page: prevPage = null },
      },
      multisigPendingCount: prevMultisigPendingCount,
    } = prevProps

    if (page !== prevPage || multisigPendingCount !== prevMultisigPendingCount) {
      let activeView = 0

      if (page === 'history' && !isMobile) activeView = 1
      if (page === 'invoices') activeView = 2

      if (page === 'exit') {
        wpLogoutModal(() => {
          history.push(localisedUrl(locale, links.home))
        }, intl)
      }

      this.setState({
        activeView,
        multisigPendingCount,
      })
    }
    //@ts-ignore
    clearTimeout(this.syncTimer)
  }

  componentDidMount() {
    const {
      match: {
        params,
        params: { page },
        url,
      },
      multisigPendingCount,
      history,
      location: { pathname },
      intl,
      intl: { locale },
    } = this.props

    if (pathname.toLowerCase() == links.connectWallet.toLowerCase()) {
      this.handleConnectWallet()
    }

    actions.user.getBalances()

    actions.user.fetchMultisigStatus()

    if (url.includes('send')) {
      this.handleWithdraw(params)
    }

    if (page === 'exit') {
      wpLogoutModal(() => {
        history.push(localisedUrl(locale, links.home))
      }, intl)
    }
    this.getInfoAboutCurrency()
    this.setState({
      multisigPendingCount,
    })
  }

  componentWillUnmount() {
    console.log('Wallet unmounted')
  }

  getInfoAboutCurrency = async () => {
    const { currencies } = this.props
    const currencyNames = currencies.map(({ name }) => name)

    await actions.user.getInfoAboutCurrency(currencyNames)
  }

  handleWithdraw = (params) => {
    const { allData } = this.props
    const { address, amount } = params
    const item = allData.find(
      ({ currency }) => currency.toLowerCase() === params.currency.toLowerCase()
    )

    actions.modals.open(constants.modals.Withdraw, {
      ...item,
      toAddress: address,
      amount,
    })
  }

  goToСreateWallet = () => {
    feedback.wallet.pressedAddCurrency()
    const {
      history,
      intl: { locale },
    } = this.props

    history.push(localisedUrl(locale, links.createWallet))
  }

  handleGoExchange = () => {
    const {
      history,
      intl: { locale },
    } = this.props

    history.push(localisedUrl(locale, links.exchange))
  }

  handleModalOpen = (context) => {
    const { enabledCurrencies, allData } = this.state
    const { hiddenCoinsList } = this.props

    /* @ToDo Вынести отдельно */
    // Набор валют для виджета
    const widgetCurrencies = ['BTC']
    /*
    if (!hiddenCoinsList.includes('BTC (SMS-Protected)'))
      widgetCurrencies.push('BTC (SMS-Protected)')
      */
    if (!hiddenCoinsList.includes('BTC (PIN-Protected)')) {
      widgetCurrencies.push('BTC (PIN-Protected)')
    }
    if (!hiddenCoinsList.includes('BTC (Multisig)')) {
      widgetCurrencies.push('BTC (Multisig)')
    }
    widgetCurrencies.push('ETH')
    widgetCurrencies.push('BNB')
    widgetCurrencies.push('GHOST')
    widgetCurrencies.push('NEXT')
    if (isWidgetBuild) {
      if (window.widgetERC20Tokens && Object.keys(window.widgetERC20Tokens).length) {
        // Multi token widget build
        Object.keys(window.widgetERC20Tokens).forEach((key) => {
          widgetCurrencies.push(key.toUpperCase())
        })
      } else {
        widgetCurrencies.push(config.erc20token.toUpperCase())
      }
    }

    const currencies = allData.filter(({ isMetamask, isConnected, currency, address, balance }) => {
        return (
          (context === 'Send' ? balance : true) &&
          !hiddenCoinsList.includes(currency) &&
          !hiddenCoinsList.includes(`${currency}:${address}`) &&
          enabledCurrencies.includes(currency) &&
          (!isMetamask || (isMetamask && isConnected)) &&
          (isWidgetBuild ? widgetCurrencies.includes(currency) : true)
        )
      })

    //@ts-ignore: strictNullChecks
    actions.modals.open(constants.modals.CurrencyAction, {
      currencies,
      context,
    })
  }

  handleWithdrawFirstAsset = () => {
    const {
      history,
      intl: { locale },
      hiddenCoinsList,
    } = this.props
    const { allData } = this.state

    let tableRows = allData.filter(({ currency, address, balance }) => {
      // @ToDo - В будущем нужно убрать проверку только по типу монеты.
      // Старую проверку оставил, чтобы у старых пользователей не вывалились скрытые кошельки

      return (
        !hiddenCoinsList.includes(currency) &&
        !hiddenCoinsList.includes(`${currency}:${address}`) &&
        balance > 0
      )
    })

    if (tableRows.length === 0) {
      actions.notifications.show(
        constants.notifications.Message,
        {message: (
          <FormattedMessage 
            id="WalletEmptyBalance"
            defaultMessage="Balance is empty"
          />
        )}
      )

      return
    }

    const { currency, address } = tableRows[0]

    let targetCurrency = currency
    switch (currency.toLowerCase()) {
      case 'btc (multisig)':
      case 'btc (sms-protected)':
      case 'btc (pin-protected)':
        targetCurrency = 'btc'
        break
    }

    const isToken = helpers.ethToken.isEthToken({ name: currency })

    history.push(
      localisedUrl(locale, (isToken ? '/token' : '') + `/${targetCurrency}/${address}/send`)
    )
  }

  syncData = () => {
    // that is for noxon, dont delete it :)
    const now = moment().format('HH:mm:ss DD/MM/YYYY')
    const lastCheck = localStorage.getItem(constants.localStorage.lastCheckBalance) || now
    const lastCheckMoment = moment(lastCheck, 'HH:mm:ss DD/MM/YYYY')

    const isFirstCheck = moment(now, 'HH:mm:ss DD/MM/YYYY').isSame(lastCheckMoment)
    const isOneHourAfter = moment(now, 'HH:mm:ss DD/MM/YYYY').isAfter(
      lastCheckMoment.add(1, 'hours')
    )

    const { ethData } = this.props.tokensData

    //@ts-ignore
    this.syncTimer = setTimeout(async () => {
      if (config?.entry !== 'mainnet' || !metamask.isCorrectNetwork()) {
        return;
      }
      if (isOneHourAfter || isFirstCheck) {
        localStorage.setItem(constants.localStorage.lastCheckBalance, now)
        try {
          const ipInfo = await stats.getIPInfo()

          const registrationData = {
            locale:
              ipInfo.locale ||
              (navigator.userLanguage || navigator.language || 'en-gb').split('-')[0],
            ip: ipInfo.ip,
          }

          let widgetUrl
          if (appConfig.isWidget) {
            widgetUrl = getTopLocation().origin
            //@ts-ignore
            registrationData.widget_url = widgetUrl
          }

          const tokensArray: any[] = Object.values(this.props.tokensData)

          const wallets = tokensArray.map((item) => ({
            symbol: item && item.currency ? item.currency.split(' ')[0] : '',
            type: item && item.currency ? item.currency.split(' ')[1] || 'common' : '',
            address: item && item.address ? item.address : '',
            balance: item && item.balance ? new BigNumber(item.balance).toNumber() : 0,
            public_key: item && item.publicKey ? item.publicKey.toString('Hex') : '',
            entry: config?.entry ? config.entry : 'testnet:undefined',
            // TODO: let this work
            // nounce: 1,
            // signatures_required: 1,
            // signatories: [],
          }))
          //@ts-ignore
          registrationData.wallets = wallets

          await stats.updateUser(ethData.address, getTopLocation().host, registrationData)
        } catch (error) {
          console.error(`Sync error in wallet: ${error}`)
        }
      }
    }, 2000)
  }

  render() {
    const {
      allData,
      activeView,
      infoAboutCurrency,
      enabledCurrencies,
      multisigPendingCount,
    } = this.state

    const {
      hiddenCoinsList,
      isBalanceFetching,
      activeFiat,
      activeCurrency,
      match: {
        params: { page = null },
      },
    } = this.props

    this.syncData()

    let btcBalance = 0
    let changePercent = 0

    // Набор валют для виджета
    const widgetCurrencies = ['BTC']

    if (!hiddenCoinsList.includes('BTC (PIN-Protected)')) {
      widgetCurrencies.push('BTC (PIN-Protected)')
    }
    if (!hiddenCoinsList.includes('BTC (Multisig)')) {
      widgetCurrencies.push('BTC (Multisig)')
    }
    widgetCurrencies.push('ETH')
    widgetCurrencies.push('BNB')
    widgetCurrencies.push('GHOST')
    widgetCurrencies.push('NEXT')
    if (isWidgetBuild) {
      if (window.widgetERC20Tokens && Object.keys(window.widgetERC20Tokens).length) {
        // Multi token widget build
        Object.keys(window.widgetERC20Tokens).forEach((key) => {
          widgetCurrencies.push(key.toUpperCase())
        })
      } else {
        widgetCurrencies.push(config.erc20token.toUpperCase())
      }
    }

    let tableRows = allData.filter(({ currency, address, balance }) => {
      // @ToDo - В будущем нужно убрать проверку только по типу монеты.
      // Старую проверку оставил, чтобы у старых пользователей не вывалились скрытые кошельки

      return (
        (!hiddenCoinsList.includes(currency) &&
          !hiddenCoinsList.includes(`${currency}:${address}`)) ||
        balance > 0
      )
    })

    tableRows = tableRows.filter(({ currency }) => enabledCurrencies.includes(currency))

    tableRows = tableRows.map((el) => {
      return {
        ...el,
        balance: el.balance,
        fiatBalance:
          el.balance > 0 && el.infoAboutCurrency?.price_fiat
            ? new BigNumber(el.balance)
                .multipliedBy(el.infoAboutCurrency.price_fiat)
                .dp(2, BigNumber.ROUND_FLOOR)
            : 0,
      }
    })

    tableRows.forEach(({ name, infoAboutCurrency, balance, currency }) => {
      const currName = currency || name

      if (
        (!isWidgetBuild || widgetCurrencies.includes(currName)) &&
        infoAboutCurrency &&
        balance !== 0
      ) {
        if (currName === 'BTC') {
          changePercent = infoAboutCurrency.percent_change_1h
        }
        btcBalance += balance * infoAboutCurrency.price_btc
      }
    })

    const allFiatBalance = tableRows.reduce((acc, cur) => new BigNumber(cur.fiatBalance).plus(acc), 0)

    return (
      <DashboardLayout
        page={page}
        isDark={isDark}
        BalanceForm={
          <BalanceForm
            isDark={isDark}
            activeFiat={activeFiat}
            fiatBalance={allFiatBalance}
            currencyBalance={btcBalance}
            changePercent={changePercent}
            activeCurrency={activeCurrency}
            handleReceive={this.handleModalOpen}
            handleWithdraw={this.handleWithdrawFirstAsset}
            handleExchange={this.handleGoExchange}
            isFetching={isBalanceFetching}
            type="wallet"
            currency="btc"
            infoAboutCurrency={infoAboutCurrency}
            multisigPendingCount={multisigPendingCount}
          />
        }
      >
        {activeView === 0 && (
          <CurrenciesList
            isDark={!!isDark}
            tableRows={tableRows}
            hiddenCoinsList={hiddenCoinsList}
            goToСreateWallet={this.goToСreateWallet}
            multisigPendingCount={multisigPendingCount}
          />
        )}
        {activeView === 1 && <History {...this.props} isDark={isDark} />}
        {activeView === 2 && <InvoicesList {...this.props} onlyTable={true} isDark={isDark} />}
      </DashboardLayout>
    )
  }
}

export default injectIntl(Wallet)
