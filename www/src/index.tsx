import './errors'
import { render } from 'preact'
import { ReceiptListPanel } from './components/ReceiptList'
import { Scanner } from './components/Scanner'

import './index.css'

if ('serviceWorker' in navigator) {
	if (process.env.NODE_ENV === 'development') {
		navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(x => x.unregister()))
	} else {
		navigator.serviceWorker.register('./service_worker.js')
	}
}

render(
	<>
		<Scanner />
		<ReceiptListPanel />
	</>,
	document.body,
)
