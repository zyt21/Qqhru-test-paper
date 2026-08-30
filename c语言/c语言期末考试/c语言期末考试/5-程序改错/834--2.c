/*------------------------------------------------------    
【程序改错】
--------------------------------------------------------

题目：下面给定程序的功能是：输入学生成绩并显示。
      请改正程序中的错误，使程序能得到正确的运行结果。

--------------------------------------------------------
注意：不可以增加或删除程序行，也不可以更改程序的结构。
------------------------------------------------------*/
# include <stdio.h>

struct student
{
    char number[6];
    char name[6];
    int  score[3];
/**********FOUND**********/
} stu[2];
/**********FOUND**********/
void output(struct student stu[2]);

main()
{
    int i, j;
    for(i=0; i<2; i++)
    {
        printf("请输入学生%d的成绩：\n", i+1);
        printf("学号：");
        scanf("%s", stu[i].number);
        printf("姓名：");
        scanf("%s", stu[i].name);
        for(j=0; j<3; j++)
        {
            printf("成绩 %d.  ", j+1);
/**********FOUND**********/
            scanf("%d", &stu[i].score[j]);
        }
        printf("\n");
    }
    output(stu);
}
void output(struct student stu[2])
{
    int i, j;
    printf("学号  姓名  成绩1  成绩2  成绩3\n");
    for(i=0; i<2; i++)
    {
        printf("%-6s%-6s", stu[i].number, stu[i].name);
        for(j=0; j<3; j++)
/**********FOUND**********/
            printf("%-8d", stu[i].score[j]);
        printf("\n");
    }
}
