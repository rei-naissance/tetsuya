/**
 * Furigana for the app's own Japanese labels: section names, question types,
 * mock-test papers, page headings. Question-bank text gets furigana at build
 * time (scripts/japanese.mjs); these are typed in the code, so their readings
 * are written out here. Values use the {漢字|かな} markup the JP component reads.
 */
const READINGS: Record<string, string> = {
  日本語能力試験: '{日本語|にほんご}{能力|のうりょく}{試験|しけん}',
  日本語: '{日本語|にほんご}',
  模擬試験: '{模擬|もぎ}{試験|しけん}',
  漢字読み: '{漢字|かんじ}{読|よ}み',
  漢字: '{漢字|かんじ}',
  語彙: '{語彙|ごい}',
  文法形式の判断: '{文法|ぶんぽう}{形式|けいしき}の{判断|はんだん}',
  文法: '{文法|ぶんぽう}',
  読解: '{読解|どっかい}',
  聴解: '{聴解|ちょうかい}',
  単語: '{単語|たんご}',
  文型: '{文型|ぶんけい}',
  助詞: '{助詞|じょし}',
  表記: '{表記|ひょうき}',
  文脈規定: '{文脈|ぶんみゃく}{規定|きてい}',
  言い換え類義: '{言|い}い{換|か}え{類義|るいぎ}',
  用法: '{用法|ようほう}',
  文の組み立て: '{文|ぶん}の{組|く}み{立|た}て',
  文章の文法: '{文章|ぶんしょう}の{文法|ぶんぽう}',
  内容理解: '{内容|ないよう}{理解|りかい}',
  絵を見て: '{絵|え}を{見|み}て',
  聞いて答える: '{聞|き}いて{答|こた}える',
  即時応答: '{即時|そくじ}{応答|おうとう}',
  課題理解: '{課題|かだい}{理解|りかい}',
  概要理解: '{概要|がいよう}{理解|りかい}',
  発話表現: '{発話|はつわ}{表現|ひょうげん}',
  理解: '{理解|りかい}',
  言語知識: '{言語|げんご}{知識|ちしき}',
  文字: '{文字|もじ}',
  お疲れさま: 'お{疲|つか}れさま',
  完了: '{完了|かんりょう}',
  課: '{課|か}',
}
const KEYS = Object.keys(READINGS).sort((a, b) => b.length - a.length)

/** "言語知識（文字・語彙）" → "{言語|げんご}{知識|ちしき}（{文字|もじ}・{語彙|ごい}）" (longest match first). */
export function ruby(text: string): string {
  let out = ''
  for (let i = 0; i < text.length;) {
    const key = KEYS.find((k) => text.startsWith(k, i))
    if (key) { out += READINGS[key]; i += key.length }
    else out += text[i++]
  }
  return out
}
