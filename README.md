# DNS Loadbalancer with Consensus
Node.js based Layer 4 DNS Load-balancer with consensus for Flux. This script will forward DNS queries to your DNS dapps running on Flux, and will return the answer if more than 2 nodes agree with the result. The script is in beta and haven't been tested for large-scale traffic.

## How to Run

* Edit `config/default.js` and enter your Flux appName and containerPort for DNS queries.
* run `node index.js`