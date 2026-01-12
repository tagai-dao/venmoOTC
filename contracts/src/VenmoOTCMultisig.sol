// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev ERC20 接口简化版，用于处理 USDT
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title VenmoOTCMultisig
 * @dev 这是一个 2/2 多签合约，用于 OTC 交易中的 USDT 托管
 */
contract VenmoOTCMultisig {
    
    enum OrderStatus { OPEN, EXECUTED, CANCELLED }
    enum Choice { NONE, INITIATOR, COUNTERPARTY }

    struct Order {
        address initiator;      // 发起方 (用户 A)
        address counterparty;   // 对手方 (用户 B)
        uint256 amount;         // USDT 数量
        Choice initiatorChoice; // 发起方的选择
        Choice counterpartyChoice; // 对手方的选择
        OrderStatus status;     // 订单状态
        bool initiatorSigned;   // 发起方是否已签名
        bool counterpartySigned;// 对手方是否已签名
    }

    IERC20 public usdtToken;
    uint256 public nextOrderId;
    mapping(uint256 => Order) public orders;

    event OrderCreated(uint256 indexed orderId, address indexed initiator, address indexed counterparty, uint256 amount);
    event OrderSigned(uint256 indexed orderId, address indexed signer, Choice choice);
    event OrderExecuted(uint256 indexed orderId, address indexed recipient, uint256 amount);
    event ChoiceUpdated(uint256 indexed orderId, address indexed signer, Choice newChoice);

    constructor(address _usdtToken) {
        usdtToken = IERC20(_usdtToken);
    }

    /**
     * @dev 创建一个新的多签订单
     * @param _counterparty 对手方地址
     * @param _amount USDT 数量
     */
    function createOrder(address _counterparty, uint256 _amount) external returns (uint256) {
        require(_counterparty != address(0), "Invalid counterparty address");
        require(_counterparty != msg.sender, "Cannot trade with yourself");
        require(_amount > 0, "Amount must be greater than 0");

        // 转移 USDT 到合约托管
        require(usdtToken.transferFrom(msg.sender, address(this), _amount), "USDT transfer failed");

        uint256 orderId = nextOrderId++;
        Order storage order = orders[orderId];
        order.initiator = msg.sender;
        order.counterparty = _counterparty;
        order.amount = _amount;
        order.status = OrderStatus.OPEN;

        emit OrderCreated(orderId, msg.sender, _counterparty, _amount);
        return orderId;
    }

    /**
     * @dev 参与者签名（选择资金目的地）
     * @param _orderId 订单 ID
     * @param _choice 目的地选择 (INITIATOR 或 COUNTERPARTY)
     */
    function signOrder(uint256 _orderId, Choice _choice) external {
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.OPEN, "Order not open");
        require(_choice != Choice.NONE, "Invalid choice");
        
        bool isInitiator = (msg.sender == order.initiator);
        bool isCounterparty = (msg.sender == order.counterparty);
        require(isInitiator || isCounterparty, "Not authorized");

        if (isInitiator) {
            order.initiatorChoice = _choice;
            order.initiatorSigned = true;
        } else {
            order.counterpartyChoice = _choice;
            order.counterpartySigned = true;
        }

        emit OrderSigned(_orderId, msg.sender, _choice);

        // 如果双方都已签名且选择一致，则自动执行
        if (order.initiatorSigned && order.counterpartySigned && order.initiatorChoice == order.counterpartyChoice) {
            _executeOrder(_orderId);
        }
    }

    /**
     * @dev 更新选择（当对方还未达成一致时，可以修改自己的目的地选择）
     * @param _orderId 订单 ID
     * @param _newChoice 新的目的地选择
     */
    function updateChoice(uint256 _orderId, Choice _newChoice) external {
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.OPEN, "Order not open");
        require(_newChoice != Choice.NONE, "Invalid choice");

        bool isInitiator = (msg.sender == order.initiator);
        bool isCounterparty = (msg.sender == order.counterparty);
        require(isInitiator || isCounterparty, "Not authorized");

        if (isInitiator) {
            require(order.initiatorSigned, "Not signed yet");
            order.initiatorChoice = _newChoice;
        } else {
            require(order.counterpartySigned, "Not signed yet");
            order.counterpartyChoice = _newChoice;
        }

        emit ChoiceUpdated(_orderId, msg.sender, _newChoice);

        // 如果双方都已签名且选择一致，则自动执行
        if (order.initiatorSigned && order.counterpartySigned && order.initiatorChoice == order.counterpartyChoice) {
            _executeOrder(_orderId);
        }
    }

    /**
     * @dev 内部执行订单转账逻辑
     */
    function _executeOrder(uint256 _orderId) internal {
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.OPEN, "Order already processed");
        require(order.initiatorChoice == order.counterpartyChoice, "Choices do not match");

        address recipient;
        if (order.initiatorChoice == Choice.INITIATOR) {
            recipient = order.initiator;
        } else {
            recipient = order.counterparty;
        }

        order.status = OrderStatus.EXECUTED;
        
        require(usdtToken.transfer(recipient, order.amount), "USDT transfer failed");

        emit OrderExecuted(_orderId, recipient, order.amount);
    }

    /**
     * @dev 获取订单详情
     */
    function getOrder(uint256 _orderId) external view returns (
        address initiator,
        address counterparty,
        uint256 amount,
        Choice initiatorChoice,
        Choice counterpartyChoice,
        OrderStatus status,
        bool initiatorSigned,
        bool counterpartySigned
    ) {
        Order storage order = orders[_orderId];
        return (
            order.initiator,
            order.counterparty,
            order.amount,
            order.initiatorChoice,
            order.counterpartyChoice,
            order.status,
            order.initiatorSigned,
            order.counterpartySigned
        );
    }
}
