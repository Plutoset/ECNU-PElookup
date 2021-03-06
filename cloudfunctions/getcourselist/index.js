// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database({env:'chake-7g37b76526c08c7a'})
const MAX_LIMIT = 20
const $ = db.command.aggregate
exports.main = async (event, context) => {
  // 先取出集合记录总数
  const countResult = await db.collection('Evaluation')
  .aggregate()
  .group({
    _id: '$sort',
  })
  .count("count")
  .end()
  const total = countResult.list[0].count
  // 计算需分几次取
  const batchTimes = Math.ceil(total / 20)
  console.log("几次",batchTimes)
  // 承载所有读操作的 promise 的数组
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    const promise = db.collection('Evaluation')
    .aggregate()
    .unwind('$teacher')
    .group({
      _id: {
        'sort': '$sort',
        'class': '$class',
      },
      'teachers': $.addToSet('$teacher'),
    })
    .group({
      _id: '$_id.sort',
      'classes': $.addToSet({
        'class': '$_id.class',
        'teachers': '$teachers'
      })
    })
    .addFields({
      'sort': '$_id'
    })
    .project({
      _id: 0,
      'sort': 1,
      'classes': 1,
    })
    .skip(i * MAX_LIMIT)
    .limit(MAX_LIMIT)
    .end()
    tasks.push(promise)
  }
  
  // 等待所有
  return (await Promise.all(tasks)).reduce((acc, cur) => {
    return {
      data: acc.data.concat(cur.list),
      errMsg: acc.errMsg,
    }
  },{
    data: [],
    errMsg: "",
  })
}