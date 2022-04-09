module.exports = {
    apps:[
        {
            name:"pdns",
            port:50,
            ipList:[],
            protocol:"udp",
            consensusNumber:3,
            loadbalancingMethod:"rr",
            timeout:50
        }
    ]    
}