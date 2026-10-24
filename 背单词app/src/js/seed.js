(function () {
  'use strict';
  const VW = globalThis.VW = globalThis.VW || {};

  // 内置示例词书：60 词，全字段，3 个 List，含形近/近义词对（供辨析题测试）
  const BOOK_ID = 'sample-book';
  const NOW = '2026-10-21T00:00:00.000Z';

  function W(sp, uk, us, senses, ex, o) {
    o = o || {};
    return Object.assign({
      id: VW.util.normalizeKey(sp),
      spelling: sp,
      phoneticUK: uk, phoneticUS: us,
      senses: senses.map(function (s) { return { pos: s[0], zh: s[1] }; }), // [{pos, zh}]
      examples: ex ? [ex] : [],                // {en, zh}
      collocations: [], synonyms: [], antonyms: [],
      roots: '', image: '', mnemonic: '', etymology: '',
      examTags: [], difficulty: 3, frequency: 3,
      bookId: BOOK_ID, unit: 'List 1',
      customTags: [], notes: '', favorite: false,
      createdAt: NOW, updatedAt: NOW
    }, o);
  }
  const ex = function (en, zh) { return { en: en, zh: zh }; };

  VW.seed = {
    BOOK: {
      id: BOOK_ID, name: '示例词书·四六级核心', type: '考试',
      desc: '内置示例词书（60 词），用于体验全部功能。正式词库可在“词书”页导入。',
      tags: ['四六级', '示例'], version: '1.0', changelog: '内置示例词书 v1.0',
      enabled: true, createdAt: NOW, updatedAt: NOW
    },
    entries: [
      // ===== List 1 =====
      W('abandon', '[əˈbændən]', '[əˈbændən]', [['vt.', '抛弃；放弃'], ['n.', '放纵']],
        ex('He abandoned the plan because of the bad weather.', '由于天气恶劣，他放弃了这个计划。'),
        { collocations: ['abandon oneself to 沉溺于'], synonyms: ['desert', 'give up'], antonyms: ['keep', 'maintain'], roots: 'a- 离去 + bandon 支配', examTags: ['CET4', '考研'], difficulty: 2, frequency: 4, unit: 'List 1' }),
      W('ability', '[əˈbɪləti]', '[əˈbɪləti]', [['n.', '能力；才能']],
        ex('She has the ability to solve difficult problems.', '她有解决难题的能力。'),
        { collocations: ['to the best of one\'s ability 尽某人所能'], synonyms: ['capability', 'capacity'], antonyms: ['inability'], examTags: ['CET4', '高考'], difficulty: 1, frequency: 5, unit: 'List 1' }),
      W('absolute', '[ˈæbsəluːt]', '[ˈæbsəluːt]', [['adj.', '绝对的；完全的']],
        ex('There is no absolute standard for beauty.', '美没有绝对的标准。'),
        { collocations: ['absolute majority 绝对多数'], synonyms: ['complete', 'total'], antonyms: ['relative'], examTags: ['CET4'], difficulty: 2, frequency: 4, unit: 'List 1' }),
      W('absorb', '[əbˈzɔːb]', '[əbˈzɔːrb]', [['vt.', '吸收；使专心']],
        ex('Plants absorb water from the soil.', '植物从土壤中吸收水分。'),
        { collocations: ['be absorbed in 全神贯注于'], synonyms: ['take in', 'soak up'], roots: 'ab- 离去 + sorb 吸收', examTags: ['CET4', '考研'], difficulty: 2, frequency: 4, unit: 'List 1' }),
      W('abstract', '[ˈæbstrækt]', '[ˈæbstrækt]', [['adj.', '抽象的'], ['n.', '摘要']],
        ex('Beauty is an abstract concept.', '美是一个抽象的概念。'),
        { collocations: ['abstract concept 抽象概念'], synonyms: ['theoretical'], antonyms: ['concrete'], examTags: ['CET4', '考研'], difficulty: 3, frequency: 3, unit: 'List 1' }),
      W('abundant', '[əˈbʌndənt]', '[əˈbʌndənt]', [['adj.', '丰富的；充裕的']],
        ex('The region is abundant in natural resources.', '该地区自然资源丰富。'),
        { collocations: ['be abundant in 富于'], synonyms: ['plentiful', 'rich'], antonyms: ['scarce'], examTags: ['CET6'], difficulty: 3, frequency: 3, unit: 'List 1' }),
      W('academic', '[ˌækəˈdemɪk]', '[ˌækəˈdemɪk]', [['adj.', '学术的；学院的'], ['n.', '大学教师']],
        ex('His academic performance is excellent.', '他的学业成绩优秀。'),
        { collocations: ['academic year 学年'], synonyms: ['scholarly'], examTags: ['CET4', '考研'], difficulty: 2, frequency: 4, unit: 'List 1' }),
      W('accelerate', '[əkˈseləreɪt]', '[əkˈseləreɪt]', [['v.', '加速；促进']],
        ex('The government took measures to accelerate economic growth.', '政府采取措施加速经济增长。'),
        { collocations: ['accelerate the pace 加快步伐'], synonyms: ['speed up', 'hasten'], antonyms: ['slow down', 'decelerate'], examTags: ['CET4', '考研'], difficulty: 3, frequency: 3, unit: 'List 1' }),
      W('access', '[ˈækses]', '[ˈækses]', [['n.', '通道；机会'], ['vt.', '访问；存取']],
        ex('Students have free access to the library.', '学生可以免费使用图书馆。'),
        { collocations: ['have access to 可以使用'], synonyms: ['entrance', 'entry'], examTags: ['CET4', '考研', '雅思'], difficulty: 2, frequency: 5, unit: 'List 1' }),
      W('accompany', '[əˈkʌmpəni]', '[əˈkʌmpəni]', [['vt.', '陪伴；伴随；为…伴奏']],
        ex('She accompanied her friend to the hospital.', '她陪朋友去了医院。'),
        { collocations: ['be accompanied by 由…陪同'], synonyms: ['go with', 'escort'], examTags: ['CET4'], difficulty: 2, frequency: 3, unit: 'List 1' }),
      W('accomplish', '[əˈkʌmplɪʃ]', '[əˈkɑːmplɪʃ]', [['vt.', '完成；实现']],
        ex('They accomplished the task ahead of schedule.', '他们提前完成了任务。'),
        { collocations: ['accomplish a goal 达成目标'], synonyms: ['achieve', 'complete'], antonyms: ['fail'], examTags: ['CET4', '考研'], difficulty: 2, frequency: 3, unit: 'List 1' }),
      W('accurate', '[ˈækjərət]', '[ˈækjərət]', [['adj.', '准确的；精确的']],
        ex('The report gives an accurate description of the accident.', '报告准确描述了事故经过。'),
        { collocations: ['accurate information 准确信息'], synonyms: ['exact', 'precise'], antonyms: ['inaccurate'], examTags: ['CET4', '高考'], difficulty: 2, frequency: 4, unit: 'List 1' }),
      W('accuse', '[əˈkjuːz]', '[əˈkjuːz]', [['vt.', '指责；控告']],
        ex('She accused him of lying.', '她指责他说谎。'),
        { collocations: ['accuse sb of sth 指控某人某事'], synonyms: ['charge', 'blame'], examTags: ['CET4'], difficulty: 2, frequency: 3, unit: 'List 1' }),
      W('achieve', '[əˈtʃiːv]', '[əˈtʃiːv]', [['vt.', '达到；完成；获得']],
        ex('He worked hard to achieve his dream.', '他努力实现自己的梦想。'),
        { collocations: ['achieve success 取得成功'], synonyms: ['accomplish', 'attain'], antonyms: ['fail'], examTags: ['CET4', '高考'], difficulty: 1, frequency: 5, unit: 'List 1' }),
      W('acknowledge', '[əkˈnɒlɪdʒ]', '[əkˈnɑːlɪdʒ]', [['vt.', '承认；致谢；确认收到']],
        ex('He acknowledged that he had made a mistake.', '他承认自己犯了错误。'),
        { collocations: ['acknowledge receipt 确认收到'], synonyms: ['admit', 'recognize'], antonyms: ['deny'], examTags: ['CET6', '考研'], difficulty: 3, frequency: 3, unit: 'List 1' }),
      W('acquire', '[əˈkwaɪə(r)]', '[əˈkwaɪər]', [['vt.', '获得；学到']],
        ex('It takes time to acquire a new skill.', '掌握一项新技能需要时间。'),
        { collocations: ['acquire knowledge 获得知识'], synonyms: ['obtain', 'gain'], antonyms: ['lose'], examTags: ['CET4', '考研'], difficulty: 2, frequency: 4, unit: 'List 1' }),
      W('adapt', '[əˈdæpt]', '[əˈdæpt]', [['v.', '适应；改编']],
        ex('It took him a while to adapt to the new environment.', '他花了一段时间适应新环境。'),
        { collocations: ['adapt to 适应'], synonyms: ['adjust', 'modify'], roots: 'ad- 向 + apt 适合', examTags: ['CET4', '考研'], difficulty: 2, frequency: 4, unit: 'List 1' }),
      W('adequate', '[ˈædɪkwət]', '[ˈædɪkwət]', [['adj.', '足够的；胜任的']],
        ex('The room is adequate for two people.', '这个房间住两个人足够了。'),
        { collocations: ['adequate for 足以'], synonyms: ['sufficient', 'enough'], antonyms: ['inadequate'], examTags: ['CET6'], difficulty: 3, frequency: 3, unit: 'List 1' }),
      W('adjust', '[əˈdʒʌst]', '[əˈdʒʌst]', [['v.', '调整；适应']],
        ex('You can adjust the height of the chair.', '你可以调整椅子的高度。'),
        { collocations: ['adjust to 适应'], synonyms: ['adapt', 'modify'], examTags: ['CET4'], difficulty: 2, frequency: 4, unit: 'List 1' }),
      W('admire', '[ədˈmaɪə(r)]', '[ədˈmaɪər]', [['vt.', '钦佩；欣赏']],
        ex('I admire her courage.', '我钦佩她的勇气。'),
        { collocations: ['admire sb for sth 因某事钦佩某人'], synonyms: ['respect', 'appreciate'], examTags: ['CET4'], difficulty: 1, frequency: 4, unit: 'List 1' }),

      // ===== List 2 =====
      W('adopt', '[əˈdɒpt]', '[əˈdɑːpt]', [['vt.', '采用；收养']],
        ex('The company adopted a new strategy.', '公司采用了新策略。'),
        { collocations: ['adopt a policy 采取政策'], synonyms: ['take up', 'embrace'], antonyms: ['reject'], examTags: ['CET4', '考研'], difficulty: 2, frequency: 4, unit: 'List 2' }),
      W('affect', '[əˈfekt]', '[əˈfekt]', [['vt.', '影响；感动']],
        ex('The weather can affect your mood.', '天气会影响你的心情。'),
        { collocations: ['be affected by 受…影响'], synonyms: ['influence'], examTags: ['CET4', '高考'], difficulty: 2, frequency: 5, unit: 'List 2' }),
      W('effect', '[ɪˈfekt]', '[ɪˈfekt]', [['n.', '效果；影响'], ['vt.', '实现']],
        ex('The medicine had a good effect on him.', '这药对他效果很好。'),
        { collocations: ['have an effect on 对…有影响', 'take effect 生效'], synonyms: ['influence', 'result'], antonyms: ['cause'], examTags: ['CET4', '高考'], difficulty: 1, frequency: 5, unit: 'List 2' }),
      W('afford', '[əˈfɔːd]', '[əˈfɔːrd]', [['vt.', '负担得起；提供']],
        ex('We can\'t afford to buy a new car.', '我们买不起新车。'),
        { collocations: ['afford to do 负担得起做'], synonyms: ['manage', 'spare'], examTags: ['CET4', '高考'], difficulty: 2, frequency: 4, unit: 'List 2' }),
      W('aggressive', '[əˈɡresɪv]', '[əˈɡresɪv]', [['adj.', '好斗的；进取的；侵略性的']],
        ex('He is very aggressive in business.', '他在生意上很有进取心。'),
        { collocations: ['aggressive behavior 攻击性行为'], synonyms: ['hostile', 'pushy'], antonyms: ['gentle'], examTags: ['CET6'], difficulty: 3, frequency: 3, unit: 'List 2' }),
      W('alter', '[ˈɔːltə(r)]', '[ˈɔːltər]', [['v.', '改变；改动']],
        ex('She altered the dress to fit her.', '她改了裙子使之合身。'),
        { collocations: ['alter the plan 改变计划'], synonyms: ['change', 'modify'], examTags: ['CET4', '考研'], difficulty: 2, frequency: 3, unit: 'List 2' }),
      W('alternative', '[ɔːlˈtɜːnətɪv]', '[ɔːlˈtɜːrnətɪv]', [['n.', '替代方案'], ['adj.', '可供选择的']],
        ex('We have no alternative but to wait.', '我们别无选择只能等待。'),
        { collocations: ['have no alternative but to 除…外别无选择'], synonyms: ['option', 'choice'], examTags: ['CET6', '考研'], difficulty: 3, frequency: 4, unit: 'List 2' }),
      W('ambition', '[æmˈbɪʃn]', '[æmˈbɪʃn]', [['n.', '雄心；野心']],
        ex('His ambition is to become a scientist.', '他的志向是成为一名科学家。'),
        { collocations: ['achieve one\'s ambition 实现抱负'], synonyms: ['aspiration', 'goal'], examTags: ['CET4'], difficulty: 2, frequency: 3, unit: 'List 2' }),
      W('amuse', '[əˈmjuːz]', '[əˈmjuːz]', [['vt.', '逗乐；使消遣']],
        ex('The clown amused the children.', '小丑逗乐了孩子们。'),
        { collocations: ['amuse oneself 自娱自乐'], synonyms: ['entertain', 'delight'], examTags: ['CET4'], difficulty: 2, frequency: 3, unit: 'List 2' }),
      W('analyze', '[ˈænəlaɪz]', '[ˈænəlaɪz]', [['vt.', '分析']],
        ex('We need to analyze the data carefully.', '我们需要仔细分析数据。'),
        { collocations: ['analyze the problem 分析问题'], synonyms: ['examine', 'study'], examTags: ['CET4', '考研'], difficulty: 2, frequency: 4, unit: 'List 2' }),
      W('ancient', '[ˈeɪnʃənt]', '[ˈeɪnʃənt]', [['adj.', '古代的；古老的']],
        ex('We visited an ancient temple.', '我们参观了一座古庙。'),
        { collocations: ['ancient history 古代史'], synonyms: ['old', 'antique'], antonyms: ['modern'], examTags: ['CET4', '高考'], difficulty: 1, frequency: 4, unit: 'List 2' }),
      W('announce', '[əˈnaʊns]', '[əˈnaʊns]', [['vt.', '宣布；宣告']],
        ex('The school announced the results of the exam.', '学校公布了考试成绩。'),
        { collocations: ['announce the results 宣布结果'], synonyms: ['declare', 'state'], examTags: ['CET4'], difficulty: 2, frequency: 3, unit: 'List 2' }),
      W('annual', '[ˈænjuəl]', '[ˈænjuəl]', [['adj.', '每年的；年度的'], ['n.', '年刊']],
        ex('The company holds an annual meeting every December.', '公司每年十二月举行年会。'),
        { collocations: ['annual report 年度报告'], synonyms: ['yearly'], examTags: ['CET4', '考研'], difficulty: 2, frequency: 4, unit: 'List 2' }),
      W('anticipate', '[ænˈtɪsɪpeɪt]', '[ænˈtɪsɪpeɪt]', [['vt.', '预期；预料']],
        ex('We anticipate that sales will rise next year.', '我们预计明年销量会上升。'),
        { collocations: ['anticipate problems 预见问题'], synonyms: ['expect', 'predict'], examTags: ['CET6', '考研'], difficulty: 3, frequency: 3, unit: 'List 2' }),
      W('anxiety', '[æŋˈzaɪəti]', '[æŋˈzaɪəti]', [['n.', '焦虑；担心']],
        ex('She felt great anxiety before the interview.', '面试前她非常焦虑。'),
        { collocations: ['relieve anxiety 缓解焦虑'], synonyms: ['worry', 'unease'], antonyms: ['calm'], examTags: ['CET4', '考研'], difficulty: 3, frequency: 3, unit: 'List 2' }),
      W('apparent', '[əˈpærənt]', '[əˈpærənt]', [['adj.', '明显的；表面上的']],
        ex('It was apparent that he was tired.', '很明显他累了。'),
        { collocations: ['for no apparent reason 无缘无故'], synonyms: ['obvious', 'evident'], antonyms: ['hidden'], examTags: ['CET6'], difficulty: 3, frequency: 3, unit: 'List 2' }),
      W('appeal', '[əˈpiːl]', '[əˈpiːl]', [['v.', '呼吁；吸引；上诉'], ['n.', '吸引力；呼吁']],
        ex('The idea of working abroad appeals to her.', '出国工作的想法很吸引她。'),
        { collocations: ['appeal to 吸引；呼吁'], synonyms: ['attract', 'request'], examTags: ['CET4', '考研'], difficulty: 3, frequency: 3, unit: 'List 2' }),
      W('appreciate', '[əˈpriːʃieɪt]', '[əˈpriːʃieɪt]', [['vt.', '欣赏；感激；理解']],
        ex('I really appreciate your help.', '我非常感激你的帮助。'),
        { collocations: ['appreciate sth 感激某事'], synonyms: ['value', 'be grateful for'], examTags: ['CET4', '高考'], difficulty: 2, frequency: 4, unit: 'List 2' }),
      W('approach', '[əˈprəʊtʃ]', '[əˈproʊtʃ]', [['v.', '接近；处理'], ['n.', '方法；途径']],
        ex('We need a new approach to this problem.', '我们需要新方法解决这个问题。'),
        { collocations: ['approach to 处理…的方法'], synonyms: ['method', 'way'], examTags: ['CET4', '考研'], difficulty: 2, frequency: 5, unit: 'List 2' }),
      W('appropriate', '[əˈprəʊpriət]', '[əˈproʊpriət]', [['adj.', '合适的；恰当的']],
        ex('Wear appropriate clothes for the interview.', '面试时穿着要得体。'),
        { collocations: ['be appropriate for 适合'], synonyms: ['suitable', 'proper'], antonyms: ['inappropriate'], examTags: ['CET6', '考研'], difficulty: 3, frequency: 4, unit: 'List 2' }),

      // ===== List 3 =====
      W('approve', '[əˈpruːv]', '[əˈpruːv]', [['v.', '批准；赞成']],
        ex('The committee approved the plan.', '委员会批准了该计划。'),
        { collocations: ['approve of 赞成'], synonyms: ['endorse', 'agree'], antonyms: ['reject'], examTags: ['CET4', '考研'], difficulty: 2, frequency: 4, unit: 'List 3' }),
      W('argue', '[ˈɑːɡjuː]', '[ˈɑːrɡjuː]', [['v.', '争论；主张']],
        ex('They argued about the best way to solve the problem.', '他们争论解决问题的最佳方式。'),
        { collocations: ['argue with sb 与某人争论'], synonyms: ['debate', 'dispute'], examTags: ['CET4', '高考'], difficulty: 1, frequency: 4, unit: 'List 3' }),
      W('arise', '[əˈraɪz]', '[əˈraɪz]', [['vi.', '出现；产生；起因于']],
        ex('New problems arose after the change.', '变革后出现了新问题。'),
        { collocations: ['arise from 由…引起'], synonyms: ['occur', 'emerge'], examTags: ['CET4', '考研'], difficulty: 3, frequency: 3, unit: 'List 3' }),
      W('arouse', '[əˈraʊz]', '[əˈraʊz]', [['vt.', '唤起；激起']],
        ex('The speech aroused great interest.', '演讲引起了极大兴趣。'),
        { collocations: ['arouse interest 引起兴趣'], synonyms: ['stimulate', 'provoke'], examTags: ['CET6', '考研'], difficulty: 3, frequency: 3, unit: 'List 3' }),
      W('artificial', '[ˌɑːtɪˈfɪʃl]', '[ˌɑːrtɪˈfɪʃl]', [['adj.', '人造的；人工的；虚假的']],
        ex('The lake is artificial.', '这个湖是人工的。'),
        { collocations: ['artificial intelligence 人工智能'], synonyms: ['man-made', 'synthetic'], antonyms: ['natural'], examTags: ['CET4', '考研', '雅思'], difficulty: 3, frequency: 4, unit: 'List 3' }),
      W('assess', '[əˈses]', '[əˈses]', [['vt.', '评估；评价']],
        ex('Teachers assess students\' progress every term.', '老师每学期评估学生的进步。'),
        { collocations: ['assess the impact 评估影响'], synonyms: ['evaluate', 'estimate'], examTags: ['CET6', '雅思', '托福'], difficulty: 3, frequency: 3, unit: 'List 3' }),
      W('assign', '[əˈsaɪn]', '[əˈsaɪn]', [['vt.', '分配；指派']],
        ex('The teacher assigned homework to the class.', '老师给全班布置了作业。'),
        { collocations: ['assign sb to do 指派某人做'], synonyms: ['allocate', 'designate'], examTags: ['CET6'], difficulty: 3, frequency: 3, unit: 'List 3' }),
      W('assist', '[əˈsɪst]', '[əˈsɪst]', [['v.', '帮助；协助']],
        ex('He assisted me in carrying the boxes.', '他帮我搬箱子。'),
        { collocations: ['assist sb in doing 帮助某人做'], synonyms: ['help', 'aid'], examTags: ['CET4'], difficulty: 2, frequency: 3, unit: 'List 3' }),
      W('associate', '[əˈsəʊʃieɪt]', '[əˈsoʊʃieɪt]', [['v.', '联想；交往'], ['n.', '同事；伙伴']],
        ex('People often associate red with danger.', '人们常把红色与危险联系在一起。'),
        { collocations: ['associate with 与…交往；联想'], synonyms: ['connect', 'link'], examTags: ['CET4', '考研'], difficulty: 3, frequency: 4, unit: 'List 3' }),
      W('assume', '[əˈsjuːm]', '[əˈsuːm]', [['vt.', '假定；承担']],
        ex('Let\'s assume the plan works.', '让我们假设这个计划可行。'),
        { collocations: ['assume responsibility 承担责任'], synonyms: ['suppose', 'presume'], examTags: ['CET4', '考研', '托福'], difficulty: 2, frequency: 4, unit: 'List 3' }),
      W('assure', '[əˈʃʊə(r)]', '[əˈʃʊr]', [['vt.', '保证；使确信']],
        ex('I assure you that everything will be fine.', '我向你保证一切都会好的。'),
        { collocations: ['assure sb of sth 向某人保证'], synonyms: ['guarantee', 'promise'], examTags: ['CET4', '考研'], difficulty: 3, frequency: 3, unit: 'List 3' }),
      W('atmosphere', '[ˈætməsfɪə(r)]', '[ˈætməsfɪr]', [['n.', '大气；气氛']],
        ex('The restaurant has a warm atmosphere.', '这家餐厅气氛温馨。'),
        { collocations: ['create an atmosphere 营造气氛'], synonyms: ['mood', 'environment'], examTags: ['CET4', '雅思'], difficulty: 2, frequency: 4, unit: 'List 3' }),
      W('attach', '[əˈtætʃ]', '[əˈtætʃ]', [['vt.', '系上；附加；重视']],
        ex('Please attach a photo to your application.', '请在申请表上附一张照片。'),
        { collocations: ['attach importance to 重视'], synonyms: ['fasten', 'fix'], antonyms: ['detach'], examTags: ['CET4', '考研'], difficulty: 3, frequency: 3, unit: 'List 3' }),
      W('attain', '[əˈteɪn]', '[əˈteɪn]', [['vt.', '达到；获得']],
        ex('She attained her goal after years of effort.', '经过多年努力她实现了目标。'),
        { collocations: ['attain a goal 达到目标'], synonyms: ['achieve', 'accomplish'], examTags: ['CET6'], difficulty: 3, frequency: 3, unit: 'List 3' }),
      W('attempt', '[əˈtempt]', '[əˈtempt]', [['n.', '尝试；企图'], ['vt.', '尝试']],
        ex('He made an attempt to break the record.', '他尝试打破纪录。'),
        { collocations: ['make an attempt to 尝试做'], synonyms: ['try', 'effort'], examTags: ['CET4'], difficulty: 2, frequency: 4, unit: 'List 3' }),
      W('attend', '[əˈtend]', '[əˈtend]', [['v.', '出席；照料；注意']],
        ex('All students must attend the meeting.', '所有学生必须参加会议。'),
        { collocations: ['attend a meeting 出席会议'], synonyms: ['be present at'], examTags: ['CET4', '高考'], difficulty: 2, frequency: 4, unit: 'List 3' }),
      W('attitude', '[ˈætɪtjuːd]', '[ˈætɪtuːd]', [['n.', '态度；看法']],
        ex('A positive attitude helps you succeed.', '积极的态度有助于成功。'),
        { collocations: ['attitude towards 对…的态度'], synonyms: ['view', 'outlook'], examTags: ['CET4', '高考'], difficulty: 2, frequency: 4, unit: 'List 3' }),
      W('attract', '[əˈtrækt]', '[əˈtrækt]', [['vt.', '吸引']],
        ex('The exhibition attracted many visitors.', '展览吸引了许多参观者。'),
        { collocations: ['attract attention 吸引注意'], synonyms: ['draw', 'appeal to'], antonyms: ['repel'], examTags: ['CET4', '高考'], difficulty: 2, frequency: 4, unit: 'List 3' }),
      W('attribute', '[əˈtrɪbjuːt]', '[əˈtrɪbjuːt]', [['vt.', '把…归因于'], ['n.', '属性；特征']],
        ex('She attributes her success to hard work.', '她把成功归因于努力工作。'),
        { collocations: ['attribute to 归因于'], synonyms: ['ascribe', 'credit'], examTags: ['CET6', '考研'], difficulty: 3, frequency: 3, unit: 'List 3' }),
      W('authentic', '[ɔːˈθentɪk]', '[ɔːˈθentɪk]', [['adj.', '真正的；可靠的']],
        ex('The restaurant serves authentic Italian food.', '这家餐厅供应正宗的意大利菜。'),
        { collocations: ['authentic experience 真实体验'], synonyms: ['genuine', 'real'], antonyms: ['fake'], examTags: ['考研', '雅思'], difficulty: 3, frequency: 3, unit: 'List 3' })
    ],

    // 首次运行自动装载（只装一次）
    ensure: function () {
      const api = VW.store.api;
      if (!api) return Promise.resolve(false);
      return api.books.get(BOOK_ID).then(function (book) {
        if (book) return false;
        return api.books.save(VW.seed.BOOK).then(function () {
          return api.entries.bulkSave(VW.seed.entries);
        }).then(function () {
          return VW.settings.get();
        }).then(function (s) {
          if (!s.defaultBookId) return VW.settings.save({ defaultBookId: BOOK_ID });
          return null;
        }).then(function () { return true; });
      });
    }
  };
})();
